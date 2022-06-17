# Redis架构解析

> Redis是一个开放源代码（BSD许可）内存中的数据结构存储，用作数据库、缓存和消息代理。它支持字符串、哈希、列表、集合、带范围查询的排序集合、位图、超日志和流的地理空间索引等数据结构。Redis具有内置的复制、lua脚本、lru回收、事务和不同级别的磁盘上持久性，并通过Redis Sentinel和Redis集群的自动分区提供高可用性。
>
> Redis作者：意大利人 Salvatore Sanfilippo（网名 Antirez） 开发。Antirez 不仅帅的不像实力派（见下图），也非常有趣。Antirez 今年已经四十岁了，依旧在孜孜不倦地写代码，为 Redis 的开源事业持续贡献力量。



## Redis性能测试

Redis 自带了一个压力测试工具`redis-benchmark`，使用这个工具就可以进行管道测试。

首先我们对一个普通的 set 指令进行压测，QPS 大约 5w/s。

```Shell
> redis-benchmark -t set -q

SET: 51975.05 requests per second
```

我们加入管道选项`-P`参数，它表示单个管道内并行的请求数量，看下面`P=2`，QPS 达到了 9w/s。

```Shell
> redis-benchmark -t set -P 2 -q

SET: 91240.88 requests per second
```

再看看`P=3`，QPS 达到了 10w/s。

```SQL
SET: 102354.15 requests per second
```

但如果再继续提升 P 参数，发现 QPS 已经上不去了。这是为什么呢？

因为这里 CPU 处理能力已经达到了瓶颈，Redis 的单线程 CPU 已经飙到了 100%，所以无法再继续提升了。



## Redis为什么这么快？

正常情况下，Redis执行命令的速度非常快，官方给出的数字是读写性能可以达到10万/秒，当然这也取决于机器的性能，但这里先不讨论机器性能上的差异，只分析一下是什么造就了Redis除此之快的速度，可以大致归纳为以下五点：

1. Redis是用C语言实现的，一般来说C语言实现的程序“距离”操作系统更近，执行速度相对会更快。
2. 完全基于内存，绝大部分请求是纯粹的内存操作，非常快速。数据存在内存中，类似于HashMap，HashMap的优势就是查找和操作的时间复杂度都是O(1)；正因为 Redis 是单线程，所以要小心使用 Redis 指令，对于那些时间复杂度为 O(n) 级别的指令，一定要谨慎使用，一不小心就可能会导致 Redis 卡顿。
3. 数据结构简单，对数据操作也简单，Redis中的数据结构是专门进行设计的；采用单线程，避免了不必要的上下文切换和竞争条件，也不存在多进程或者多线程导致的切换而消耗 CPU，不用去考虑各种锁的问题，不存在加锁释放锁操作，没有因为可能出现死锁而导致的性能消耗；
4. 使用多路I/O复用模型，非阻塞IO，Redis 单线程处理大量的并发客户端连接的模型。 使用底层模型不同，它们之间底层实现方式以及与客户端之间通信的应用协议不一样，Redis直接自己构建了VM 机制 ，因为一般的系统调用系统函数的话，会浪费一定的时间去移动和请求；
5. 作者对于Redis源代码可以说是精打细磨，曾经有人评价Redis是少有的集性能和优雅于一身的开源代码。



## Redis通信架构

第一层：客户端，大家熟知的如原生redis-cli、java语言Jedis、python语言redis-py等

第二层：通信，传输层基于TCP的resp协议

第三层：服务端，多路复用、事件循环、持久化等

![Redis](http://img.javalemon.com/typora/Redis.png)

## Redis处理流程架构

redis的整体核心在服务端的处理

流程图如下：![Redis6](http://img.javalemon.com/typora/Redis6.png)



## Redis事件

### 文件事件

Redis通过套接字与客户端（或者其他服务器）进行连接，而文件事件就是服务器对套接字操作的抽象。服务器与客户端的通信会产生相应的文件事件，而服务器则通过监听并处理这些事件来完成一系列的网络通信操作。

Redis基于Reactor模式开发了自己的网络事件处理器：这个处理器则被称为文件时间处理器。

文件事件处理器使用I/O多路复用程序来同时监听多个套接字，并根据套接字目前执行的任务来为套接字关联不同的时间处理器。

当被监听的套接字准备好执行连接应答accept、读取read、写入write、关闭close等操作时，与操作相对应的文件事件就会产生，这时文件事件处理器就会调用套接字之前关联好的事件处理器来处理这些事件。

![Redis5](http://img.javalemon.com/typora/Redis5.png)

### 时间事件

Redis服务器中一些操作（比如serverCron的函数）则需要在给定的时间点执行，时间事件就是服务器对这类定时操作的抽象。默认一秒执行10次，即100ms执行一次。配置在redis.conf中的hz

serverCron函数的主要工作：

1. 更新服务器的各类统计信息，比如内存占用、数据库占用情况等。
2. 清理数据库中的过期键值对。
3. 关闭和清理链接失效的客户端。
4. 尝试进行AOF或RDB持久化操作。
5. 如果服务器是主服务器，对从服务器进行定时同步。
6. 集群模式，对集群进行定期同步和连接测试。

![Redis4](http://img.javalemon.com/typora/Redis4.png)![]()

## 客户端服务端交互

1. Client 发起socket连接
2. Server 接受socket连接
3. 客户端写入
4. Server端接收写入
5. Server返回结果
6. Client收到返回结果

![Redis3](http://img.javalemon.com/typora/Redis3.png)

## Redis I/O多路复用技术

epoll详解参照资料：

1. 详解：http://blog.chinaunix.net/uid-24517549-id-4051156.html
2. 实现机制：https://blog.csdn.net/shenya1314/article/details/73691088
3. 多种线程模型比对：[IO模型解惑](https://missfresh.feishu.cn/space/doc/doccn7KIBMI8p7P84mZ1kCCXQDg) 

介绍一下epoll，Redis事件管理器核心实现基本依赖于它。

首先来看epoll是什么，它能做什么？

epoll是在Linux 2.6内核中引进的，是一种强大的I/O多路复用技术，上面我们已经说到在进行网络操作的时候是通过文件描述符来进行读写的，那么平常我们就是一个进程操作一个文件描述符。然而epoll可以通过一个文件描述符管理多个文件描述符，并且不阻塞I/O。这使得我们单进程可以操作多个文件描述符，这就是redis在高并发性能还如此强大的原因之一。

下面简单介绍epoll 主要的三个方法：

1. int epoll_create(int size) //创建一个epoll句柄用于监听文件描述符FD，size用于告诉内核这个监听的数目一共有多大。该epoll句柄创建后在操作系统层面只会占用一个fd值，但是它可以监听size+1 个文件描述符。
2. int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event) //epoll事件注册函数,在创建文件事件的时候进行调用注册
3. int epoll_wait(int epfd, struct epoll_event * events, int maxevents, int timeout)//等待事件的产生

Redis 的事件管理器主要是基于epoll机制，先采用 epoll_ctl方法 注册事件，然后再使用epoll_wait方法取出已经注册的事件。
