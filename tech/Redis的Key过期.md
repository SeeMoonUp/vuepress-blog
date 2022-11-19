# Redis的key过期策略

## 带着问题来学习？

1. redis的key过期策略是什么？
2. redis的key过期是单线程还是多线程的？

## redis的key过期策略是什么？

1. 惰性删除
2. serverCron定时任务（时间事件）删除

## 看完以下的源码，你就懂了



![d2c0d150-9c2e-4933-adb3-3f3ca649ecfc](http://img.javalemon.com/typora/d2c0d150-9c2e-4933-adb3-3f3ca649ecfc.svg)

### 时间事件的执行流程

redis在初始化的时候创建了时间事件，其中有一项如下：

server.c 源码如下：

```c
/* Create the timer callback, this is our way to process many background
     * operations incrementally, like clients timeout, eviction of unaccessed
     * expired keys and so forth.
     * 创建serverCron的时间事件 */
if (aeCreateTimeEvent(server.el, 1, serverCron, NULL, NULL) == AE_ERR) {
     serverPanic("Can't create event loop timers.");
     exit(1);
}

int serverCron(struct aeEventLoop *eventLoop, long long id, void *clientData) {
  /* Handle background operations on Redis databases. 处理数据库后台相关操作*/
    databasesCron();
}

/* This function handles 'background' operations we are required to do
 * incrementally in Redis databases, such as active key expiring, resizing,
 * rehashing. */
void databasesCron(void) {
		/* Expire keys by random sampling. Not required for slaves
     * as master will synthesize DELs for us. */
    if (server.active_expire_enabled && server.masterhost == NULL) {
        activeExpireCycle(ACTIVE_EXPIRE_CYCLE_SLOW);
    } else if (server.masterhost != NULL) {
        expireSlaveKeys();
    }
}
```

expire.c中处理了核心的流程：

```
#define ACTIVE_EXPIRE_CYCLE_LOOKUPS_PER_LOOP 20 /* Loopkups per loop. */
void activeExpireCycle(int type) {
	// 此处省略了大量的附属逻辑，一下为过期key的核心
	do {
	  // 本次查询到的过期的key数量
	  expired = 0;
		// num最大为20个
		num = ACTIVE_EXPIRE_CYCLE_LOOKUPS_PER_LOOP;
  	while (num--) {
	  	// 随机获取redis的key
			if ((de = dictGetRandomKey(db->expires)) == NULL) break;
	 	 	// 此处为核心逻辑，执行key的过期动作
  		if (activeExpireCycleTryExpire(db,de,now)) expired++;
  	
		}	
		// 直到过期的key少于25%，不再进行下一次轮询，即结束key过期处理。
	} while (expired > ACTIVE_EXPIRE_CYCLE_LOOKUPS_PER_LOOP/4);

}

int activeExpireCycleTryExpire(redisDb *db, dictEntry *de, long long now) {
  // 此处的一个关键配置项：lazyfree_lazy_expire，是否启用异步线程处理
	if (server.lazyfree_lazy_expire)
		dbAsyncDelete(db,keyobj);
	else
		dbSyncDelete(db,keyobj);
}
```

lazyfree.c中的异步删除动作：

```
#define LAZYFREE_THRESHOLD 64
int dbAsyncDelete(redisDb *db, robj *key) {
    /* Deleting an entry from the expires dict will not free the sds of
     * the key, because it is shared with the main dictionary. */
    if (dictSize(db->expires) > 0) dictDelete(db->expires,key->ptr);

    /* If the value is composed of a few allocations, to free in a lazy way
     * is actually just slower... So under a certain limit we just free
     * the object synchronously. */
    dictEntry *de = dictUnlink(db->dict,key->ptr);
    if (de) {
        robj *val = dictGetVal(de);
        // 按照数据的大小来决定是否进行异步处理
        size_t free_effort = lazyfreeGetFreeEffort(val);

        /* If releasing the object is too much work, do it in the background
         * by adding the object to the lazy free list.
         * Note that if the object is shared, to reclaim it now it is not
         * possible. This rarely happens, however sometimes the implementation
         * of parts of the Redis core may call incrRefCount() to protect
         * objects, and then call dbDelete(). In this case we'll fall
         * through and reach the dictFreeUnlinkedEntry() call, that will be
         * equivalent to just calling decrRefCount(). */
         // 长度大于64 并且引用次数=1（非共享数据） 才进行异步处理
        if (free_effort > LAZYFREE_THRESHOLD && val->refcount == 1) {
            atomicIncr(lazyfree_objects,1);
            bioCreateBackgroundJob(BIO_LAZY_FREE,val,NULL,NULL);
            dictSetVal(db->dict,de,NULL);
        }
    }

    /* Release the key-val pair, or just the key if we set the val
     * field to NULL in order to lazy free it later. */
    if (de) {
        dictFreeUnlinkedEntry(db->dict,de);
        if (server.cluster_enabled) slotToKeyDel(key);
        return 1;
    } else {
        return 0;
    }
}

/**
* list -> 判断quickList的大小
* set-> 判断hashtable的大小
* zset-> 判断skipList的大小
* hash -> 判断hashtable的大小
* 其他均为简单类型 返回1
*/
size_t lazyfreeGetFreeEffort(robj *obj) {
    if (obj->type == OBJ_LIST) {
        quicklist *ql = obj->ptr;
        return ql->len;
    } else if (obj->type == OBJ_SET && obj->encoding == OBJ_ENCODING_HT) {
        dict *ht = obj->ptr;
        return dictSize(ht);
    } else if (obj->type == OBJ_ZSET && obj->encoding == OBJ_ENCODING_SKIPLIST){
        zset *zs = obj->ptr;
        return zs->zsl->length;
    } else if (obj->type == OBJ_HASH && obj->encoding == OBJ_ENCODING_HT) {
        dict *ht = obj->ptr;
        return dictSize(ht);
    } else {
        return 1; /* Everything else is a single allocation. */
    }
}
```



server.lazyfree_lazy_expire 是从哪里配置的？

默认初始值为：

```
#define CONFIG_DEFAULT_LAZYFREE_LAZY_EXPIRE 0 默认为false
server.lazyfree_lazy_expire = CONFIG_DEFAULT_LAZYFREE_LAZY_EXPIRE;
```

redis.conf中有如下配置项

```
lazyfree-lazy-eviction no：是否异步驱逐 key，当内存达到上限，分配失败后
lazyfree-lazy-expire no：是否异步进行 key 过期事件的处理
lazyfree-lazy-server-del no：del 命令是否异步执行删除操作，类似 unlink
replica-lazy-flush no：replica client 做全同步的时候，是否异步 flush 本地 db
```

config.c中进行赋值如下：

```
// config初始化-读取配置中的值
config_get_bool_field("lazyfree-lazy-expire", server.lazyfree_lazy_expire);
```

### del命令的执行流程

```
// 默认为同步
void delCommand(client *c) {
    delGenericCommand(c,0);
}

void unlinkCommand(client *c) {
    delGenericCommand(c,1);
}

/* This command implements DEL and LAZYDEL. */
void delGenericCommand(client *c, int lazy) {
    int numdel = 0, j;

    for (j = 1; j < c->argc; j++) {
        expireIfNeeded(c->db,c->argv[j]);
        int deleted  = lazy ? dbAsyncDelete(c->db,c->argv[j]) :
                              dbSyncDelete(c->db,c->argv[j]);
        if (deleted) {
            signalModifiedKey(c->db,c->argv[j]);
            notifyKeyspaceEvent(NOTIFY_GENERIC,
                "del",c->argv[j],c->db->id);
            server.dirty++;
            numdel++;
        }
    }
    addReplyLongLong(c,numdel);
}
```

### expire命令的执行流程：

```
/* EXPIRE key seconds */
void expireCommand(client *c) {
    expireGenericCommand(c,mstime(),UNIT_SECONDS);
}

void expireGenericCommand(client *c, long long basetime, int unit) {
    robj *key = c->argv[1], *param = c->argv[2];
    long long when; /* unix time in milliseconds when the key will expire. */

    if (getLongLongFromObjectOrReply(c, param, &when, NULL) != C_OK)
        return;

    if (unit == UNIT_SECONDS) when *= 1000;
    when += basetime;

    /* No key, return zero. */
    if (lookupKeyWrite(c->db,key) == NULL) {
        addReply(c,shared.czero);
        return;
    }

    /* EXPIRE with negative TTL, or EXPIREAT with a timestamp into the past
     * should never be executed as a DEL when load the AOF or in the context
     * of a slave instance.
     *
     * Instead we take the other branch of the IF statement setting an expire
     * (possibly in the past) and wait for an explicit DEL from the master. */
    if (when <= mstime() && !server.loading && !server.masterhost) {
        robj *aux;

				// 比如设置的为负数，则直接进入delete流程
        int deleted = server.lazyfree_lazy_expire ? dbAsyncDelete(c->db,key) :
                                                    dbSyncDelete(c->db,key);
        serverAssertWithInfo(c,key,deleted);
        server.dirty++;

        /* Replicate/AOF this as an explicit DEL or UNLINK. */
        aux = server.lazyfree_lazy_expire ? shared.unlink : shared.del;
        rewriteClientCommandVector(c,2,aux,key);
        signalModifiedKey(c->db,key);
        notifyKeyspaceEvent(NOTIFY_GENERIC,"del",key,c->db->id);
        addReply(c, shared.cone);
        return;
    } else {
        setExpire(c,c->db,key,when);
        addReply(c,shared.cone);
        signalModifiedKey(c->db,key);
        notifyKeyspaceEvent(NOTIFY_GENERIC,"expire",key,c->db->id);
        server.dirty++;
        return;
    }
}

```

### get命令的执行流程

```
void getCommand(client *c) {
    getGenericCommand(c);
}

int getGenericCommand(client *c) {
    robj *o;

		// 查找key对应的val
    if ((o = lookupKeyReadOrReply(c,c->argv[1],shared.null[c->resp])) == NULL)
        return C_OK;

    if (o->type != OBJ_STRING) {
        addReply(c,shared.wrongtypeerr);
        return C_ERR;
    } else {
        addReplyBulk(c,o);
        return C_OK;
    }
}

robj *lookupKeyReadOrReply(client *c, robj *key, robj *reply) {
    robj *o = lookupKeyRead(c->db, key);
    if (!o) addReply(c,reply);
    return o;
}

robj *lookupKeyRead(redisDb *db, robj *key) {
    return lookupKeyReadWithFlags(db,key,LOOKUP_NONE);
}

// 寻找key对应的val
robj *lookupKeyReadWithFlags(redisDb *db, robj *key, int flags) {
    robj *val;

    if (expireIfNeeded(db,key) == 1) {
        // key过期的执行流程
    }
    val = lookupKey(db,key,flags);
    if (val == NULL) {
        server.stat_keyspace_misses++;
        notifyKeyspaceEvent(NOTIFY_KEY_MISS, "keymiss", key, db->id);
    }
    else
        server.stat_keyspace_hits++;
    return val;
}

// 判断key是否过期
int expireIfNeeded(redisDb *db, robj *key) {
    if (!keyIsExpired(db,key)) return 0;
    /* Delete the key */
    server.stat_expiredkeys++;
    propagateExpire(db,key,server.lazyfree_lazy_expire);
    notifyKeyspaceEvent(NOTIFY_EXPIRED,
        "expired",key,db->id);
		//如果key过期 则根据是否懒删除 进行同步或者异步操作
    return server.lazyfree_lazy_expire ? dbAsyncDelete(db,key) :
                                         dbSyncDelete(db,key);
}
```



参考资料：

https://www.modb.pro/db/58276

https://juejin.cn/book/6844733724618129422/section/6844733724748152840
