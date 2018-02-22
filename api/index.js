exports.route = {
  get () {
    this.related('admin', '所有管理员端接口')
    this.related('card', {
      get: '{ date?: yyyy-M-d, page? } 一卡通信息及消费流水，不带 date 为当日流水',
      put: '{ password, amount: float, eacc?=1 } 一卡通在线充值'
    })
    this.related('curriculum', '{ term? } 课表查询（返回格式可能随上游可用性变化）')
    this.related('exam', '考试查询')
    this.related('gpa', '成绩及绩点查询')
    this.related('jwc', '教务通知')
    this.related('lecture', '讲座打卡记录')
    this.related('library', {
      post: '{ password: 图书馆密码 } 查询已借图书',
      put: '{ cookies, bookId, borrowId } 续借图书'
    })
    this.related('pe', '跑操次数查询')
    this.related('phylab', '物理实验查询')
    this.related('qiniu', '前端执行七牛上传所需的 uptoken')
    this.related('reservation', '{ method, ... } 场馆预约，具体参见代码')
    this.related('srtp', 'SRTP 学分及项目查询')
    this.related('wlan', {
      get: '校园网状态查询',
      post: '{ months: int } 自动开通/续期/解锁',
      delete: '{ ip?, mac? } 下线IP/删除免认证设备'
    })
  }
}
