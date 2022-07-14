module.exports = {
	title: '电商的那些事',
	description: '电商的技术架构',
	port: '8099',
	themeConfig: {
		nav: [
			{text: '首页', link: '/'},
			{
				text: '电商博客',
				items:[
					{text: '产品解决方案', link: '/mall/服务高可用设计.md'},
					{text: '技术架构模型', link: '/mall/'},
					{text: '设计原则', link: '/mall/'},
					{text: '稳定性', link: '/mall/'}
				]
			},
			{
				text: '程序员进阶',
				items:[
					{text: '编程基础', link: '/tech/'},
					{text: '架构', link: '/tech/'},
					{text: '', link: 'https://www.baidu.com'}
				]
			},
			{
				text: '工作思考',
				link: '/think/'
				// items:[
				// 	{text: '软技能', link: 'https://www.baidu.com'},
				// 	{text: '呈现表达能力', link: 'https://www.baidu.com'},
				// 	{text: '思维模型', link: 'https://www.baidu.com'}
				// ]
			}
		],
		sidebar: {
			'/mall/': [
				{
					title: '欢迎学习',
					path: '/mall/',
					collapsable: false,
					children: [
						{title: '导读', path: "/mall/导读"},
						{title: '浅谈电商模式', path: "/mall/浅谈电商模式"}
					]
				},
				{
					title: '产品解决方案',
					path: '/mall/',
					collapsable: false,
					children: [
						{title: '首页动态化布局', path: "/mall/首页动态化布局"},
						{title: '活动搭建平台', path: "/mall/活动搭建平台"},
						{title: '分类页设计', path: "/mall/分类页设计"},
						{title: '购物车建设', path: "/"},
						{title: '核心交易流程', path: "/mall/核心交易流程"},
						{title: '智能推荐场景', path: "/"}
					]
				},
				{
					title: '技术架构模型',
					path: '/mall/',
					collapsable: false,
					children: [
						{title: '秒杀体系', path: "/mall/"},
						{title: '服务高可用设计', path: "/mall/服务高可用设计"},
						{title: '支付系统建设模型', path: "/mall/支付系统建设模型"},
						{title: '交易系统建设模型', path: "/mall/交易系统建设模型"},
						{title: '后管系统建设自动化', path: "/mall/后管系统建设自动化"},
						{title: '营销系统建设', path: "/"},
						{title: '平台化建设', path: "/"}
					]
				},
				{
					title: '设计原则',
					path: '/mall/',
					collapsable: false,
					children: [
						{title: '编码规范管理', path: "/"},
						{title: '系统职责边界', path: "/"}
					]
				},
				{
					title: '稳定性',
					path: '/mall/',
					collapsable: false,
					children: [
						{title: '如何发现问题', path: "/"},
						{title: '问题处理的原则', path: "/"},
						{title: '解决处理提效手段', path: "/"},
					]
				}
			],
			'/tech/': [
				{
					title: '欢迎学习',
					path: '/',
					collapsable: false,
					children: [
						{title: '学前必读', path: "/"}
					]
				},
				{
					title: '编程基础',
					path: '/handbook/a',
					collapsable: false,
					children: [
						{title: '页面动态化布局', path: "/"}
					]
				},
				{
					title: '架构',
					path: '/handbook/a',
					collapsable: false,
					sidebarDepth: 1,    // 可选的, 默认值是 1
					children: [
						{title: '服务演进', path: "/tech/架构-服务演进"},
						{title: 'SOA | REST | RPC', path: "/"},
						{title: '分布式基础理论', path: "/tech/分布式基础理论"},
						{title: '分布式事务', path: "/"},
						{title: '服务容灾设计', path: "/"},
						{title: '平台化建设', path: "/"},
						{title: '支付系统建设模型', path: "/"},
						{title: '交易系统建设模型', path: "/"},
					]
				},
				{
					title: '数据库',
					path: '/handbook/a',
					collapsable: false,
					children: [
						{title: '编码规范管理', path: "/"},
						{title: '系统职责边界', path: "/"}
					]
				},
				{
					title: '中间件',
					path: '/handbook/a',
					collapsable: false,
					children: [
						{title: 'Redis架构解析', path: "/tech/Redis架构解析"},
						{title: 'Redis哨兵及集群', path: "/tech/Redis哨兵及集群"},
						{title: 'Redis的key过期处理策略', path: "/tech/Redis的key过期处理策略"},
						{title: 'Redis数据结构', path: "/"},
						{title: '问题处理的原则', path: "/"},
						{title: '解决处理提效手段', path: "/"}
					]
				},
				{
					title: '框架',
					path: '/handbook/a',
					collapsable: false,
					children: [
						{title: '团队配合', path: "/"},
						{title: '向上管理', path: "/"},
						{title: '向下管理', path: "/"}
					]
				}
			],
			'/': [
				{
					title: '欢迎学习',
					path: '/',
					collapsable: false,
					children: [
						{title: '学前必读', path: "/mall/导读"}
					]
				}
			]
		}
	}
}
