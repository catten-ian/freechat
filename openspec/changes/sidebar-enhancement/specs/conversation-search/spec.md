## ADDED Requirements

### Requirement: 搜索对话标题
系统 SHALL 允许用户通过关键词搜索对话标题。

#### Scenario: 搜索匹配标题
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统过滤并显示标题包含该关键词的对话

#### Scenario: 搜索无匹配
- **WHEN** 用户搜索的关键词在所有对话标题中都不存在
- **THEN** 系统显示"无匹配对话"提示

#### Scenario: 清空搜索
- **WHEN** 用户清空搜索框
- **THEN** 系统恢复显示所有对话

### Requirement: 搜索对话内容
系统 SHALL 允许用户搜索对话中的消息内容。

#### Scenario: 搜索匹配内容
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统搜索所有对话的消息内容
- **AND** 显示包含该关键词的对话列表

#### Scenario: 搜索结果高亮
- **WHEN** 搜索结果显示对话时
- **THEN** 高亮显示匹配的消息片段

### Requirement: 搜索性能优化
系统 SHOULD 在对话数量超过 100 条时使用索引优化搜索性能。

#### Scenario: 大量对话搜索
- **WHEN** 用户有超过 100 条对话时进行搜索
- **THEN** 搜索响应时间 SHOULD 在 200ms 以内

### Requirement: 搜索历史
系统 MAY 记录用户最近的搜索关键词。

#### Scenario: 显示搜索历史
- **WHEN** 用户点击搜索框时
- **THEN** 显示最近 5 条搜索记录
