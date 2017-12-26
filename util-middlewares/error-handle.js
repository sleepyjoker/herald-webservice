/**
 * Created by WolfTungsten on 2017/12/26.
 */

module.exports = async (ctx, next) => {
    try{
        await next()
    }
    catch (err){
        ctx.response.status = err.statusCode;
        if(ctx.debug) {
            ctx.body = {
                'error':err
            }
        }
        else{
            ctx.body = {
                'error_code': err.errorCode,
                'error_msg': err.msg
            }
        }
    }
}