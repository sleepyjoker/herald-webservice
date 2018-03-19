const { config } = require('../app')
const axios = require('axios').create({
  baseURL: 'https://api.weixin.qq.com/cgi-bin/',
  ...config.axios
})
const { wechat } = require('./sdk.json')
const lastToken = {}

const getToken = async (type) => {
  let { token, expire = 0 } = lastToken[type] || {}
  let now = new Date().getTime()
  if (expire > now) {
    return token
  }

  let { data: { access_token, expires_in }} = await axios.get(
    '/token?grant_type=client_credential' +
    `&appid=${wechat[type].appid}&secret=${wechat[type].appsecret}`
  )
  lastToken[type] = {
    token: access_token,

    // 这里使用请求开始前的时间戳计算过期时间，这样比较保险
    // 因为微信服务器是从收到请求时开始计算过期时长的，这样算可以让服务器上的过期时间比微信稍早一点
    expire: now + expires_in * 1000
  }
  return access_token
}

const fakeAxios = (type) => {
  let ret = {}
  'get,post,put,delete'.split(',').map(k => {
    ret[k] = async (path, ...args) => {
      let token = await getToken(type)
      path = path.split('#')
      path[0] += (~path.indexOf('?') ? '&' : '?') + 'access_token=' + token
      path = path.join('#')
      return await axios[k](path, ...args)
    }
  })
  return ret
}

module.exports = {
  getToken,
  biz: fakeAxios('biz'),
  min: fakeAxios('min')
}
