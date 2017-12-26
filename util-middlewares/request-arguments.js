/**
 * Created by WolfTungsten on 2017/12/26.
 */
const error = require('../exceptions').error

module.exports = async (ctx, next) => {
    ctx.getQueryArgument = (argsName, required = true) => {
        let args = ctx.request.query[argsName];
        if(required && args === undefined){
            throw error(400, `Missing argument: ${argsName}`, -1)
        }
        else{
            return args
        }
    };

    ctx.getBodyArgument = (argsName, required = true) => {
        let args = ctx.request.body[argsName];
        if(required && args === undefined){
            throw error(400, `Missing argument: ${argsName}`, -1)
        }
        else{
            return args
        }
    };

    await next();
};