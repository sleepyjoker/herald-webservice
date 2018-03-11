const cheerio = require('cheerio')
const { config } = require('../app')

exports.route = {

  /**
   * GET /api/curriculum
   * 课表查询
   * @apiParam term 学期号（不填则为教务处设定的当前学期）
   *
   * ## 返回格式举例：
   * {
   *   term: { code, maxWeek, startDate? } // 查不到开学日期时只有前两个
   *   user: { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }
   *   curriculum: [
   *     { // 浮动课程只有前五个属性
   *       courseName, teacherName, credit,
   *       beginWeek, endWeek,       // 1 ~ 16
   *       // 非浮动课程兼有后面这些属性
   *       dayOfWeek?,               // 为了数据直观以及前端绘图方便，1-7 分别表示周一到周日
   *       flip?,                    // even 双周, odd 单周, none 全周
   *       location?,
   *       beginPeriod?, endPeriod?  // 1 ~ 13
   *     }
   *   ]
   * }
   *
   * ## 关于丁家桥课表的周次问题：
   * 在之前 webserv2 的使用中，我们发现部分院系课表的周次与常理相悖，这种现象尤以丁家桥校区为甚。
   * 经过调查，该现象是因为丁家桥校区多数院系不设短学期，短学期和秋季学期合并为一个大学期，
   * 而教务处系统不支持这种设定，致使排课老师对此进行主观处理导致的。
   * 由于不同院系排课老师理解的区别，所做的主观处理也不尽相同，具体表现有以下三种：
   *
   * 1. 短学期课表有 1-4 周，长学期课表有 1-16 周
   * 这种课表属于正常课表，不需要做任何处理即可兼容；
   *
   * 2. 短学期课表为空，长学期课表有 1-20 周
   * 这类课表出现时，老师通常让学生直接查询长学期课表，将短学期的开学日期当做长学期的开学日期。
   * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周，而且短学期为空时应当主动转化为长学期查询；
   *
   * 3. 短学期课表有 1-4 周，长学期课表有 5-20 周
   * 这类课表出现时，老师通常让学生查询短学期课表作为前四周，长学期课表作为后 16 周。
   * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周。
   **/
  async get() {
    let { term } = this.params
    let { cardnum } = this.user
    let user = {}, curriculum = []

    // 为了兼容丁家桥格式，短学期没有课的时候需要自动查询长学期
    // 为此不得已使用了一个循环
    do {
      // 老师的号码是1开头的九位数
      // 考虑到学号是八位数的情况
      let isStudent = !(/^1\d{8}$/.exec(cardnum))

      // 抓取课表页面
      let res = await (isStudent ? this.post(
        'http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action',
        {
          queryStudentId: cardnum,
          queryAcademicYear: term || undefined
        }
      ) : this.post( // 老师课表
        'http://xk.urp.seu.edu.cn/jw_service/service/teacurriculum.action',
        {
          query_teacherId: cardnum,
          query_xnxq: term || undefined
        }
      ))

      try {
        // 从课表页面抓取学期号
        term = /<font class="Context_title">[\s\S]*?(\d{2}-\d{2}-\d)[\s\S]*?<\/font>/im.exec(res.data)[1]
      } catch (e) { throw 401 }

      // 获取开学日期
      term = {
        code: term,
        startDate: config.term[term] ? new Date(config.term[term]).getTime() : null
      }

      // 从课表页面抓取身份信息
      let [collegeId, collegeName] = isStudent ?
          (/院系:\[(\d*)](.*?)</im.exec(res.data).slice(1, 3)) :
          [/(\d+)系 [^<]*课表/.exec(res.data)[1], /院系:(.*?)</im.exec(res.data)[1]]
      // FIXME 这里学生的学院编号似乎和老师的格式是不一样的
      // 不知道会有什么问题。

      // 看上去老师并没有专业
      let [majorId, majorName] = isStudent ?
          (/专业:\[([0-9A-Z]*)](.*?)</im.exec(res.data).slice(1, 3)) :
          ['','']
      // 对于老师，这个页面也没有显示学号，大约是没有的吧
      let schoolnum = isStudent ? (/学号:([0-9A-Z]*)/im.exec(res.data)[1]) : ''
      if (isStudent) {
          cardnum = /一卡通号:(\d*)/im.exec(res.data)[1]
      }
      let name = isStudent ?
          (/姓名:([^<]*)/im.exec(res.data)[1]) :
          /系 ([^<]*)课表/im.exec(res.data)[1]

      user = { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }

      // 初始化侧边栏和课表解析结果
      let sidebar = {};

      // 解析侧边栏，先搜索侧边栏所在的 table
      res.data.match(/class="tableline">([\s\S]*?)<\/table/img)[0]

        // 取 table 中所有行
        .match(/<tr height="3[48]">[\s\S]*?<\/tr\s*>/img) // 老师课表是height=38

        // 去掉表头表尾
        .slice(1, -1).map(k => {

          let courseData = k.match(/<td[^>]*>(.*?)<\/td\s*>/img)
          if (isStudent) {
            // 取每行中所有五个单元格，去掉第一格，分别抽取文本并赋给课程名、教师名、学分、周次
            courseData = courseData.slice(1)
          } else {
            // 各个单元格是: (0)序号，(1)课程名称，(2)被注释掉的老师名称，(3)老师名称，(4)课程编号，(5)课程类型*，(6)考核*，(7)学分，(8)学时，(9)周次
            // * 5 和 6 标题如此，但是内容事实上是 (5)考核 (6)课程类型。
            // 这里我们取和学生课表相同的部分
            courseData = [courseData[1],courseData[3],courseData[7],courseData[9]]
          }
          let [courseName, teacherName, credit, weeks] = courseData.map(td => cheerio.load(td).text().trim())
          credit = parseFloat(credit || 0)
          let [beginWeek, endWeek] = (weeks.match(/\d+/g) || []).map(k => parseInt(k))
          if (!isStudent) { // 只留下名字
            teacherName = teacherName.replace(/^\d+系 /, '')
          }

          // 表格中有空行，忽略空行，将非空行的值加入哈希表进行索引，以课程名+周次为索引条件
          if (courseName || weeks) {
            sidebar[courseName.trim() + '/' + weeks] = { courseName, teacherName, credit, beginWeek, endWeek }
          }
        })

      // 方法复用，传入某个单元格的 html 内容（td 标签可有可无），将单元格中课程进行解析并放入对应星期的课程列表中
      let appendClasses = (cellContent, dayOfWeek) => {

        // 流式编程高能警告
        curriculum = curriculum.concat(

          // 在单元格内容中搜索连续的三行，使得这三行中的中间一行是 [X-X周]X-X节 的格式，对于所有搜索结果
          // 老师课表(可能会)多出来一个空行
          (cellContent.match(/[^<>]*<br>(?:<br>)?\[\d+-\d+周]\d+-\d+节<br>[^<>]*/img) || []).map(k => {

            // 在搜索结果中分别匹配课程名、起止周次、起止节数、单双周、上课地点
            let [courseName, beginWeek, endWeek, beginPeriod, endPeriod, flip, location]
              = /([^<>]*)<br>(?:<br>)?\[(\d+)-(\d+)周](\d+)-(\d+)节<br>(\([单双]\))?([^<>]*)/.exec(k).slice(1);

            // 对于起止周次、起止节数，转化成整数
            [beginWeek, endWeek, beginPeriod, endPeriod] = [beginWeek, endWeek, beginPeriod, endPeriod].map(k => parseInt(k))

            // 对于单双周，转换成标准键值
            flip = {'(单)': 'odd', '(双)': 'even'}[flip] || 'none'

            // 根据课程名和起止周次，拼接索引键，在侧栏表中查找对应的课程信息
            let keyStart = courseName.trim() + '/'
            let key = keyStart + beginWeek + '-' + endWeek
            let teacherName = '', credit = ''

            // 若在侧栏中找到该课程信息，取其教师名和学分数，并标记该侧栏课程已经使用
            let ret =
                (sidebar.hasOwnProperty(key)
                 ? [key]
                 : (Object.getOwnPropertyNames(sidebar)
                    // 考虑每个课程由不同的老师教授的情况
                    // 这时侧栏上的周次并不和表格中的一致
                    // TODO 是否需要合并成一个课程?
                    .filter(k => k.startsWith(keyStart))))
                .map(k => {
                  sidebar[k].used = true
                  return { courseName,
                           teacherName: sidebar[k].teacherName,
                           credit: sidebar[k].credit,
                           location,
                           // 时间表里是总的周数
                           // 侧栏里是每个老师分别的上课周数
                           // 这里取侧栏
                           beginWeek: sidebar[k].beginWeek,
                           endWeek: sidebar[k].endWeek,
                           dayOfWeek,
                           beginPeriod,
                           endPeriod,
                           flip }
                })

            // 返回课程名，教师名，学分，上课地点，起止周次，起止节数，单双周，交给 concat 拼接给对应星期的课程列表
            return ret
          }).reduce((a, b) => a.concat(b), [])
        )
      }

      // 对于第二个大表格
      res.data.match(/class="tableline"\s*>([\s\S]*?)<\/table/img)[1]

        // 取出每一行最末尾的五个单元格，排除第一行
        .match(/(<td[^>]*>.*?<\/td>[^<]*){5}<\/tr/img).slice(1).map(k => {

          // 第 0 格交给周 1，以此类推
          k.match(/<td[^>]*>.*?<\/td>/img).map((k, i) => appendClasses(k, i + 1))
        });

      // 取周六大单元格的内容，交给周六
      appendClasses(/>周六<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 6)

      // 取周日大单元格的内容，交给周日
      appendClasses(/>周日<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 7)

      // 将侧栏中没有用过的剩余课程（浮动课程）放到 other 字段里
      curriculum = curriculum.concat(Object.values(sidebar).filter(k => !k.used))

      // 确定最大周数
      term.maxWeek = curriculum.map(k => k.endWeek).reduce((a, b) => a > b ? a : b, 0)

      // 为了兼容丁家桥表示法，本科生和教师碰到秋季学期超过 16 周的课表，将开学日期前推四周
      if (term.maxWeek > 16 && !/^22/.test(cardnum) && /-2$/.test(term.code)) {
        term.startDate -= 28 * 24 * 60 * 60 * 1000
      }

    } while ( // 为了兼容丁家桥表示法
      !curriculum.length && // 如果没有课程
      /-1$/.test(term.code) && // 而且当前查询的是短学期
      (term = term.code.replace(/-1$/, '-2')) // 则改为查询秋季学期，重新执行
    )

    return { term, user, curriculum }
  }
}
