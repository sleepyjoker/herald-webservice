# herald-webservice

小猴偷米 2018 WebService3 后端试验品，使用 Python3 + Tornado 构建；目前暂时只有框架。

## 部署

使用以下的命令来配置环境。

```bash
cd path/to/herald-webservice
pip3 install tornado
pip3 install motor
pip3 install redis
pip3 install hiredis
python3 app.py
```

## 开发

本项目非常欢迎 Issue 和 Pull Request，较有把握的更改也可以直接推送。

### 开发进度

1. **继承自 HeraldAuth**

  - [ ] 缓存数据库、隐私加密、前置身份认证

2. **继承自 WebService2**

  - [ ] 一卡通状态、一卡通当日消费、历史消费
  - [ ] 跑操次数、跑操记录、跑操预告、体测成绩
  - [ ] 课表查询、课表预测
  - [ ] 空教室查询
  - [ ] 物理实验
  - [ ] 考试安排
  - [ ] 成绩 GPA
  - [ ] SRTP
  - [ ] 人文讲座
  - [ ] 图书馆
  - [ ] 教务通知
  - [ ] 场馆预约
  - [ ] 实时班车

3. **继承自 AppService**

  - [ ] 七牛上传
  - [ ] 一卡通充值
  - [ ] 系统通知发布系统

4. **新功能提案**

  - [ ] 广告自助发布审核系统
  - [ ] 人文讲座在线发布平台
  - [ ] 食堂数据发布平台
  - [ ] 通用抢票、选座系统
  - [ ] 一卡通自助服务（挂失解挂等）
  - [ ] 网络中心自助服务（开通续费）
  - [ ] ……（欢迎补充）

### 格式规范

- `.editorconfig`中规定了基本的代码格式规范，主流编辑器均会自动读取。