const config = require('./config.json');
const axios = require('axios');
const Koa = require('koa');
const app = new Koa();
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser');
const logger = require('koa-logger');

//Herald awesome middlewares
const requestArguments = require('./util-middlewares/request-arguments');
const errorHandle = require('./util-middlewares/error-handle');
// 关闭 HTTPS 网络请求的安全验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 通用网络请求接口
app.axios = axios.create(config.axios);

//初始化中间件
app.use(async (ctx, next) => {
    //是否调试模式
    ctx.debug = config.debug;
    // 通过把 app.axios 赋给 ctx.axios 可允许在路由程序中用 this.axios 获得此实例
    ctx.axios = app.axios;
    await next();
});

// 自身请求接口
app.loopClient = axios.create({
  baseURL: `http://localhost:${config.port}/`
});

// 利用 app.get/post/put/delete 可直接请求自身
['get', 'post', 'put', 'delete'].forEach(method => app[method] = app.loopClient[method]);

//不好意思 都删掉了
//hhh

// error handler
onerror(app);

// middlewares
app.use(errorHandle);
app.use(bodyparser({
    enableTypes:['json', 'form', 'text']
}));
app.use(requestArguments);
app.use(json());
app.use(logger());

//用于静态文件服务，此处不需要
//app.use(require('koa-static')(__dirname + '/public'));

// 控制台日志
app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
});

// 加载路由
const example = require('./routes/example');
// routes
app.use(example.routes(), example.allowedMethods());


// error-handling
app.on('error', (err, ctx) => {
    console.error('server error', err, ctx)
});

app.listen(config.port);