/**
 * Created by WolfTungsten on 2017/12/26.
 */

const exception = {
    statusCode: 500, // 标准HTTP错误代号
    msg: '', // 自定义错误信息
    errorCode: 0 // 约定错误代号
}

function error(err) {
    if(arguments.length === 1) {
        for (i in exception) {
            err[i] = exception[i]
        }
        err.errorCode = -1;
        return err
    }
    if(arguments.length === 3) {
        let err = {};
        for (i in exception) {
            err[i] = exception[i]
        }
        err.statusCode = arguments[0];
        err.msg = arguments[1];
        err.errorCode = arguments[2];
        return err
    }
}

exports.error = error