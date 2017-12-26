/**
 * Created by WolfTungsten on 2017/12/26.
 */

const router = require('koa-router')();

router.prefix('/example');

router.get('/', function (ctx, next) {
    let name = ctx.getQueryArgument('name');
    ctx.body = {'name':name}
});

module.exports = router;