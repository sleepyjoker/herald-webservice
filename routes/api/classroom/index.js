let { Campus, Building, Classroom, ClassRecord, DayOfWeek, ClassOfDay } = require("./models")
const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/classroom
  * @apiParam type 要查询的数据类型，不区分大小写
  * @remark 获取某一数据表的所有条目的id与name
  * @note 前端可利用该API准备查询时的下拉框
  **/
  async get({ type }) {

    // 参数检查
    if (typeof type !== "string") {
      throw '参数 type 应该是 string'
    }

    // 转换字符串至对应的类型
    type = Object.entries(require("./models")).find(e => e[0].toLowerCase() === type.toLowerCase())[1]

    if (!type) {
      throw '找不到对应的 type'
    }

    // 返回对应类型所有条目的id与name
    return await type.find({}, {id: true, name: true})
  },

  /**
  * POST /api/classroom
  * @remark 爬取学校网站，完整更新一次数据库（校区/建筑/教室/课程数据）
  **/
  async post() {
    // 此API会对数据库进行一次大更新。
    // 为方便处理，加载所有数据到内存中，并将相关方法改为内存版本实现
    await Promise.all([Campus, Building, Classroom, ClassRecord].map(async (c, i, a) => {
      a[i].all = await a[i].find({}) // ClassName.all 获取所有对象
      a[i].findId = (name) => {
        const res = a[i].all.find(o => o.name === name);
        return res && res.id
      }
    }))

    // 方法复用，source提供原始网页数据，regex解析数据，parser将regex的一个match转换为对应的record
    // 整个函数完成一次对某一处课程信息的提取
    async function addToDB(record) {

      // 流式编程，处理需要新增校区/建筑/教室信息的情况
      ;[
        [Object,    record.notExistName],  // 哨兵顶层
        [Campus,    record.campusName],    // 校区，上层
        [Building,  record.buildingName],  // 建筑，中层
        [Classroom, record.classroomName]  // 教室，下层
      ]
        .map(([type, value]) => value && new type({ // 转换为对应的类对象
          id: type.findId(value),
          name: value
        }))
        .reduce((pre, cur, i, a) => {
          let [preName, curName] = [pre, cur].map(v => v && v.constructor.name.toLowerCase())
          if (!cur.id) { // 如果数据库中没有对应id，则新生成一条记录保存
            if (pre) { // 下层对象保存上一层Id
              a[i][preName + "Id"] = pre.id
            }
            a[i].id = Math.max(...a[i].constructor.all.map(o => o.id), 0) + 1 // 取最大Id + 1为新Id，数组为空时最大Id为0
            a[i].constructor.all.push(a[i])
            a[i].save() // await-free
          }
          // 将record中各类name属性转换为Id属性
          record[curName + "Id"] = a[i].id
          delete record[curName + "Name"]
          return a[i] // 传递上层对象给下一层
        })

      record.id = Math.max(...ClassRecord.all.map(o => o.id), 0) + 1 // FIXME：修正autoIncrement的问题
      record = new ClassRecord(record)
      ClassRecord.all.push(record)
      record.save() // await-free
    }

    let $grad = cheerio.load((await this.get("http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx")).data)
    let form = $grad('input').toArray().map(k => $grad(k)).reduce(
      (f, input) => (f[input.attr('name')] = input.attr('value'), f), {})

    let $ugrad = cheerio.load((await this.get('http://xk.urp.seu.edu.cn/jw_service/service/academyClassLook.action')).data)
    let links = $ugrad('.FrameItemFont a').toArray().map(k => $ugrad(k)).map(
      (k) => [k.text(), 'http://xk.urp.seu.edu.cn/jw_service/service/' + k.attr('href')])

    // 等待所有数据更新完毕
    // FIXME 要限制线程。一次只能抓几个。不然超时
    await Promise.all([
      // 更新研究生数据
      ...["000","001","002","003","004","005","006","007","008","009","010","011","012","014","016","017","018","019","021","022","025","040","042","044","055","080","081","084","086","101","110","111","301","316","317","318","319","401","403","404","990","997"].map(
        async department => {
          let res = await this.post(
            "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx",
            { ...form, drpyx: department }
          )
          let $ = cheerio.load(res.data)

          // /<td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^\s<]+)\s*<\/td><td>第(\d+)-(\d+)周;? ([^<]*)<\/td><td>([^<]+)<\/td><td>([^\w<]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img,
          // 找到表格，去掉标题栏
          $('#dgData > tbody > tr').toArray().slice(1)
            .map(k => $(k).find('td').toArray().map(k => $(k).text().trim())) // 找到每一栏的信息
            .forEach(
              ([name, courseId, courseName, hours, teacher, location, capacity, size]) => {
                let [, startWeek, endWeek] = /^第(\d+)-(\d+)周/.exec(hours)
                let [, buildingName, classroomName] = /^([^0-9a-zA-Z]+)([0-9a-zA-Z]+)$/.exec(location)
                hours
                  .split(' ').map(v => /星期(.)-(.+)/.exec(v)).slice(1) // 去掉第几周的信息
                  .forEach( // 把一星期中上多天的一门课拆成若干个Record
                    ([, day, time]) => {
                      let sequence = time.split(',').map(e => ClassOfDay[e])
                      let classroomFullName = buildingName + "-" + classroomName
                      addToDB({
                        name, courseId, courseName,
                        startWeek: parseInt(startWeek),
                        endWeek: parseInt(endWeek),
                        dayOfWeek: DayOfWeek[day],
                        startSequence: sequence[0],
                        endSequence: sequence[sequence.length - 1],
                        teacher, buildingName, // 名称属性将在 addToDB 中被转换为 Id 属性
                        classroomName: classroomFullName,
                        campusName: Campus.findName(buildingName),
                        capacity: parseInt(capacity),
                        size: parseInt(size)
                      })
                    }
                  )
              }
            ) // forEach courseInfo[]
        }), // map async department
      // 更新本科生课程数据
      ...links.map(
        async ([department, link]) => {
          let res = await this.get(link)
          let $ = cheerio.load(res.data)

          $('#table2 > tbody > tr').toArray().slice(1)
            .map(k => $(k).find('td').toArray().map(k => $(k).text().replace(/\&nbsp;/g, ' ').trim()))
            // .map(k => (console.log(JSON.stringify(k)), k))
            .forEach(
              ([num, term, name, standing, teacher, arrangement]) => {
                let [weeks, hours] = arrangement.split(' ')
                if (! hours) {
                  return
                }
                let [, startWeek, endWeek] = /^\[(\d+)-(\d+)周\]$/.exec(weeks)
                hours.split(',').map(v => /^周(.)\((单|双|)(\d+)-(\d+)\)(.*)$/.exec(v))
                  .forEach(async ([, day, flip, startSequence, endSequence, location]) => {
                    let buildingName, classroomName
                    if (! location) {
                      return
                    }
                    if (/-/.test(location)) {
                      ;[buildingName, classroomName] = location.split('-')
                    } else if (/大学生活动中心/.test(location)) {
                      ;[buildingName, classroomName] = ['九龙湖其它', location.replace('大学生活动中心', '大活')]
                    } else { // TODO
                      throw "不知道该如何处理 " + location
                    }
                    classroomFullName = buildingName + '-' + classroomName
                    await addToDB({
                      name,
                      courseName: name,
                      flip: {'单': 'odd', '双': 'even', '': 'none'}[flip],
                      startWeek: parseInt(startWeek),
                      endWeek: parseInt(endWeek),
                      dayOfWeek: DayOfWeek[day],
                      startSequence: parseInt(startSequence),
                      endSequence: parseInt(endSequence),
                      teacher, buildingName,
                      classroomName: classroomFullName,
                      campusName: Campus.findName(buildingName),
                    })
                  })
              }
            )
        }
      )
    ]) // Promise.all

    // 成功状态码为201 Created
    this.response.status = 201
  },

  /**
  * PUT /api/classroom
  * @apiParam type       数据的类型("Campus", "Building"等)，不区分大小写，单词需要对应
  * @apiParam values     更新数据数组
  * @remark 通过body json数据来更新数据库
  **/
  async put({ type, values }) {

    // 参数检查
    if (!(typeof type === "string" && typeof values === "object")) {
      throw (400)
    }

    // 确保values为数组形式
    if (!(values instanceof Array)) {
      // values可能为用对象表示的关联数组，此时取其值转成一般数组
      values = Object.values(values)
    }

    // 转换字符串至对应的类型
    type = Object.entries(require("./models")).find(e => e[0].toLowerCase() === type.toLowerCase())[1]

    if (!type) {
      throw (400)
    }

    // 先转换value为对应的类对象，再调用基类的save方法保存到数据库中
    values.map(v => new type(v)).forEach(v => v.save()) // await-free

    // 成功状态码为201 Created
    this.response.status = 201
  }
}
