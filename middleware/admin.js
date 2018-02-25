const chalk = require('chalk')
const crypto = require('crypto')
const db = require('../database/admin')

// 程序启动时，生成超级管理员 Token
// 为了防止与普通用户碰撞，此处字节数跟普通用户 token 字节数做区分，切勿轻易改成跟普通用户长度相同，否则会有问题
const superToken = new Buffer(crypto.randomBytes(16)).toString('hex')
console.log('本次会话的超级管理员 Token 为：' + chalk.blue(superToken) + '，请妥善保管')

module.exports = async (ctx, next) => {

  // 中间件处理，允许下游查询当前用户的权限
  ctx.admin = { super: false }
  if (ctx.request.headers.token === superToken) {
    ctx.admin.super = true
    let domains = await db.domain.find()
    for (let domain of domains) {
      ctx.admin[domain.domain] = {
        domain: domain.name,
        desc: domain.desc,
        level: 0
      }
    }
  } else if (ctx.request.headers.token
    && ctx.request.headers.token.length === superToken.length) {
    // 若 token 与超管 token 长度相同但不是超管 token，认为是老超管登录过期
    ctx.throw(401)
  } else if (ctx.user.isLogin) {
    let { cardnum } = ctx.user
    let admins = await db.admin.find({ cardnum })
    for (let admin of admins) {
      let domain = admin.domain
      let domainInfo = await db.domain.find({ domain }, 1)
      admin.domain = domainInfo.name
      admin.desc = domainInfo.desc
      ctx.admin[domain] = admin
    }

    // 利用 Proxy 机制，每当 get 某个 domain 权限时，自动更新数据库中的调用时间
    ctx.admin = new Proxy(ctx.admin, {
      set(target, key, value) {
        target[key] = value
        return true
      },
      get(target, key) {
        if (target[key]) {
          let now = new Date().getTime()
          let domain = key
          db.admin.update({ cardnum, domain }, { lastUsed: now })
        }
        return target[key]
      }
    })
  }

  await next()
}
