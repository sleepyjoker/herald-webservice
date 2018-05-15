const db = require('../database/stat')

module.exports = async (ctx, next) => {
  let start = +moment()
  try {
    await next()
  } finally {
    let end = +moment()
    let time = start
    let duration = end - start
    let identity = ctx.user && ctx.user.isLogin ? ctx.user.identity : 'guest'
    let platform = ctx.user && ctx.user.isLogin ? ctx.user.platform : 'guest'
    let route = ctx.path
    let method = ctx.method.toLowerCase()

    // 考虑到某些情况（如重定向）时，返回中没有 JSON 格式的 body，只有 status
    let status = ctx.body && ctx.body.code || ctx.status
    let record = { time, identity, platform, route, method, status, duration }
    /* await */ db.stat.insert(record)
  }
}
