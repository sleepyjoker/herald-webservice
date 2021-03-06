const db = require('../../../../database/publicity')
const admindb = require('../../../../database/admin')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin || !this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    return await Promise.all((await db.activity.find({ committedBy: cardnum }, pagesize, (page - 1) * pagesize, 'startTime-'))
      .map(async k => {
        let record = await admindb.admin.find({ cardnum: k.committedBy }, 1)
        k.committedByName = record ? record.name : k.committedBy
        if (k.admittedBy) {
          record = await admindb.admin.find({ cardnum: k.admittedBy }, 1)
          k.admittedByName = record ? record.name : k.admittedBy
        }
        k.clicks = await db.activityClick.count({ aid: k.aid })
        return k
      }))
  },
  async post ({ activity }) {
    if (!this.admin || !this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.insert(activity)
    return 'OK'
  },
  async put ({ activity }) {
    if (!this.admin || !this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.update({ aid: activity.aid, committedBy: cardnum }, activity)
    return 'OK'
  },
  async delete ({ aid }) {
    if (!this.admin || !this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    if (await db.activity.find({ aid, committedBy: cardnum }, 1)) {
      await db.activity.remove({ aid })
      await db.activityClick.remove({ aid })
      return 'OK'
    }
    throw 403
  }
}
