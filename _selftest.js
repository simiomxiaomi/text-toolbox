// Text Toolbox：操作引擎纯逻辑自测
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');

const start = src.indexOf('  /** 按 Unicode 码点切分');
const end = src.indexOf('/* ---ENGINE-END--- */');
if (start < 0 || end < 0) { console.error('抽取失败', start, end); process.exit(1); }

const mod = new Function(src.slice(start, end) + '\nreturn {' +
  'splitChars, reEscape, toLines, countLines, isBlankLine, toTitleCase, toCamelCase, toPascalCase,' +
  'toSnakeCase, toKebabCase, base64Encode, base64Decode, isBase64, urlDecodeSmart, htmlEscape,' +
  'htmlUnescape, slugify, repairJson, OPERATIONS, getOperation, applyOperation, computeStats,' +
  'charDistribution, topWords, jsonFormat, tryParse, NAMED_ENTITIES' +
  '};')();

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '\n      → ' + extra : '')); }
}
const run = (id, text, param) => mod.applyOperation(id, text, param);

console.log('\n[1] 基础工具');
t('splitChars 处理 emoji', mod.splitChars('a😀b').length === 3, mod.splitChars('a😀b').length);
t('splitChars 中文字数', mod.splitChars('你好').length === 2);
t('toLines 统一 CRLF', JSON.stringify(mod.toLines('a\r\nb\rc')) === JSON.stringify(['a', 'b', 'c']));
t('countLines 空串为 0', mod.countLines('') === 0);
t('countLines 单行', mod.countLines('abc') === 1);
t('countLines 两行', mod.countLines('a\nb') === 2);
t('countLines 尾换行', mod.countLines('a\n') === 2);
t('isBlankLine 识别空白行', mod.isBlankLine('') && mod.isBlankLine('   ') && mod.isBlankLine('\t'));
t('isBlankLine 识别非空行', !mod.isBlankLine(' a '));
t('reEscape 转义正则符', mod.reEscape('a.b*c') === 'a\\.b\\*c');

console.log('\n[2] 大小写操作');
t('upper', run('upper', 'aBc中文').text === 'ABC中文');
t('lower', run('lower', 'AbC中文').text === 'abc中文');
t('title', run('title', 'hello WORLD foo').text === 'Hello World Foo', run('title', 'hello WORLD foo').text);
t('title 保留中文', run('title', '中文 test 中文').text === '中文 Test 中文', run('title', '中文 test 中文').text);
t('sentence', run('sentence', 'hello world. foo bar! baz').text === 'Hello world. Foo bar! Baz', run('sentence', 'hello world. foo bar! baz').text);
t('camel', run('camel', 'hello world-foo_bar').text === 'helloWorldFooBar', run('camel', 'hello world-foo_bar').text);
t('pascal', run('pascal', 'hello world').text === 'HelloWorld');
t('snake', run('snake', 'helloWorld foo-bar').text === 'hello_world_foo_bar', run('snake', 'helloWorld foo-bar').text);
t('kebab', run('kebab', 'helloWorld foo_bar').text === 'hello-world-foo-bar', run('kebab', 'helloWorld foo_bar').text);
t('invert 交换大小写', run('invert', 'AbC中文123').text === 'aBc中文123', run('invert', 'AbC中文123').text);
t('camel 空输入安全', run('camel', '').text === '');

console.log('\n[3] 文本类操作');
t('去首尾空白', run('trimLines', '  a  \n\tb\t\n').text === 'a\nb\n', JSON.stringify(run('trimLines', '  a  \n\tb\t\n').text));
t('连续空格压成一个', run('collapseSpace', 'a    b\t\tc').text === 'a b c');
t('删除所有空白', run('stripAllSpace', 'a b\nc\td').text === 'abcd');
t('删除空行（含统计）', run('removeEmptyLines', 'a\n\n\nb\n').text === 'a\nb' && run('removeEmptyLines', 'a\n\n\nb\n').note === '删除 3 行空行',
  JSON.stringify(run('removeEmptyLines', 'a\n\n\nb\n')));
t('删除空行保留非空行内容', run('removeEmptyLines', 'x\n  \ny').text === 'x\ny');
t('删除行首缩进', run('removeIndent', '  a\n\tb\nc').text === 'a\nb\nc');
t('删除数字', run('removeNumbers', 'a1b22c').text === 'abc');
t('删除标点', run('removePunct', '你好，世界！a.b').text === '你好世界ab', run('removePunct', '你好，世界！a.b').text);
t('仅保留中英数字', run('removeSpecial', 'a@b#1中文').text === 'ab1中文', JSON.stringify(run('removeSpecial', 'a@b#1中文').text));
t('中文标点转英文', run('zh2enPunct', '你好，世界！').text === '你好,世界!', run('zh2enPunct', '你好，世界！').text);
t('统一换行符', run('normalizeNewline', 'a\r\nb\rc').text === 'a\nb\nc');
t('查找替换带次数', run('replace', 'a-b-c', '-|+').text === 'a+b+c' && run('replace', 'a-b-c', '-|+').note === '替换 2 处',
  JSON.stringify(run('replace', 'a-b-c', '-|+')));
t('查找替换无竖线时提示', run('replace', 'abc', '没有竖线').note.indexOf('参数格式') !== -1);
t('查找替换空旧文本保护', run('replace', 'abc', '|x').note.indexOf('不能为空') !== -1);
t('按宽度折行', run('wrapWidth', 'abcdefghij', '4').text === 'abcd\nefgh\nij', JSON.stringify(run('wrapWidth', 'abcdefghij', '4').text));
t('折行参数非法回退 40', run('wrapWidth', 'ab', 'x').note === '按 40 字符折行');

console.log('\n[4] 行处理操作');
const multi = 'banana\nApple\ncherry\napple';
t('升序排序', run('sortAsc', multi).text.split('\n')[0].toLowerCase() === 'apple', JSON.stringify(run('sortAsc', multi).text));
t('降序排序', run('sortDesc', 'a\nc\nb').text === 'c\nb\na', JSON.stringify(run('sortDesc', 'a\nc\nb').text));
t('按长度排序', run('sortLen', 'ccc\na\nbb').text === 'a\nbb\nccc', JSON.stringify(run('sortLen', 'ccc\na\nbb').text));
t('按数值排序', run('sortNum', '10\n2\n1').text === '1\n2\n10', JSON.stringify(run('sortNum', '10\n2\n1').text));
t('非数字行拒绝数值排序', run('sortNum', '10\nabc').note.indexOf('非数字') !== -1);
t('行顺序反转', run('reverseLines', 'a\nb\nc').text === 'c\nb\na');
t('去重保序并计数', run('dedupe', 'b\na\nb\nc\na').text === 'b\na\nc' && run('dedupe', 'b\na\nb\nc\na').note === '移除 2 行重复',
  JSON.stringify(run('dedupe', 'b\na\nb\nc\na')));
t('去重忽略首尾空格', run('dedupeTrim', 'a\n a \nb').text.includes('a\n') && run('dedupeTrim', 'a\n a \nb').note === '移除 1 行重复',
  JSON.stringify(run('dedupeTrim', 'a\n a \nb')));
t('添加行号对齐', run('numberLines', 'a\nb\nc').text === '1. a\n2. b\n3. c', JSON.stringify(run('numberLines', 'a\nb\nc').text));
t('添加行号对齐两位数', run('numberLines', Array.from({ length: 10 }, (_, i) => 'x' + i).join('\n')).text.split('\n')[0] === ' 1. x0',
  JSON.stringify(run('numberLines', Array.from({ length: 10 }, (_, i) => 'x' + i).join('\n')).text.split('\n')[0]));
t('移除行号', run('removeLineNo', '1. a\n2、b\n3) c').text === 'a\nb\nc', JSON.stringify(run('removeLineNo', '1. a\n2、b\n3) c').text));
t('随机打乱保持行集合', (function () {
  const before = 'a\nb\nc\nd\ne'.split('\n').sort().join(',');
  const after = run('shuffle', 'a\nb\nc\nd\ne').text.split('\n').sort().join(',');
  return before === after;
})());

console.log('\n[5] 编码类操作');
t('Base64 编码 ASCII', run('base64Encode', 'hello').text === 'aGVsbG8=');
t('Base64 编码中文', run('base64Encode', '中文').text === '5Lit5paH', run('base64Encode', '中文').text);
t('Base64 解码往返', run('base64Decode', run('base64Encode', '中文 abc 😀').text).text === '中文 abc 😀',
  JSON.stringify(run('base64Decode', run('base64Encode', '中文 abc 😀').text).text));
t('Base64 解码忽略换行', run('base64Decode', 'aGVs\nbG8=').text === 'hello');
t('Base64 解码非法输入不崩', run('base64Decode', '这不是base64@@').note.indexOf('解码失败') !== -1);
t('isBase64 判定', mod.isBase64('aGVsbG8=') && !mod.isBase64('hello!') && !mod.isBase64('abc'));
t('URL 编码', run('urlEncode', 'a b&c=中文').text === 'a%20b%26c%3D%E4%B8%AD%E6%96%87', run('urlEncode', 'a b&c=中文').text);
t('URL 解码往返', run('urlDecode', run('urlEncode', '你好 world?x=1').text).text === '你好 world?x=1');
t('URL 解码容错截断序列', run('urlDecode', '%E4%B8%AD%E6').text === '中%E6', JSON.stringify(run('urlDecode', '%E4%B8%AD%E6').text));
t('URL 解码非法序列原样保留', run('urlDecode', '%ZZ%').text === '%ZZ%', JSON.stringify(run('urlDecode', '%ZZ%').text));
t('URL 解码截断到单个字节', run('urlDecode', '%E4%B8').text === '%E4%B8', JSON.stringify(run('urlDecode', '%E4%B8').text));
t('URL 解码混合内容', run('urlDecode', 'a%20b%E4%B8%ADc').text === 'a b中c', JSON.stringify(run('urlDecode', 'a%20b%E4%B8%ADc').text));
t('URL 解码孤立百分号', run('urlDecode', '100%').text === '100%');
t('URL 解码无编码内容原样', run('urlDecode', 'no-encoding').text === 'no-encoding');
t('HTML 转义', run('htmlEscape', '<a href="x">&</a>').text === '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;', run('htmlEscape', '<a href="x">&</a>').text);
t('HTML 反转义', run('htmlUnescape', '&lt;p&gt;你好&amp;&quot;').text === '<p>你好&"');
t('HTML 反转义数字实体', run('htmlUnescape', '&#20013;&#x6587;').text === '中文', run('htmlUnescape', '&#20013;&#x6587;').text);
t('HTML 反转义命名实体', run('htmlUnescape', '&copy;&hellip;&mdash;').text === '©…—', run('htmlUnescape', '&copy;&hellip;&mdash;').text);
t('未知实体保持原样', run('htmlUnescape', '&notexist;').text === '&notexist;');
t('HTML 转义/反转义往返', run('htmlUnescape', run('htmlEscape', '<div class="a">\'x\' & y</div>').text).text === '<div class="a">\'x\' & y</div>');
t('slug 生成', run('slugify', 'Hello World! 你好，世界').text === 'hello-world-你好世界', run('slugify', 'Hello World! 你好，世界').text);
t('字符码', run('charCodes', 'A中').text === 'U+0041 U+4E2D', run('charCodes', 'A中').text);
t('转十六进制', run('toHex', '中').text === 'e4 b8 ad', run('toHex', '中').text);
t('十六进制转文本', run('fromHex', 'e4 b8 ad').text === '中', JSON.stringify(run('fromHex', 'e4 b8 ad')));
t('十六进制往返', run('fromHex', run('toHex', 'Hello 中文').text).text === 'Hello 中文');
t('十六进制奇数位容错', run('fromHex', '41 4').text === 'A', JSON.stringify(run('fromHex', '41 4').text));
t('JSON 字符串字面量', run('jsonStringify', 'a"b').text === '"a\\"b"', run('jsonStringify', 'a"b').text);

console.log('\n[6] JSON 类操作');
t('格式化 2 空格', run('jsonFormat4', '{"a":1}').text === '{\n  "a": 1\n}', JSON.stringify(run('jsonFormat4', '{"a":1}').text));
t('格式化 Tab', run('jsonFormatTab', '{"a":1}').text.indexOf('\t') !== -1);
t('格式化非法 JSON 给提示', run('jsonFormat4', '{bad}').note.indexOf('不是合法 JSON') !== -1);
t('压缩', run('jsonMinify', '{\n  "a": 1,\n  "b": [1, 2]\n}').text === '{"a":1,"b":[1,2]}', run('jsonMinify', '{\n  "a": 1,\n  "b": [1, 2]\n}').text);

const messy = "{name: 'Bob', age: 30, tags: ['a', 'b',], ok: True, note: None,}";
t('自动修复脏 JSON（可解析）', (function () {
  const r = run('jsonRepair', messy);
  try { JSON.parse(r.text); return true; } catch (e) { return false; }
})(), JSON.stringify(run('jsonRepair', messy)));
t('修复后类型正确', (function () {
  const parsed = JSON.parse(run('jsonRepair', messy).text);
  return parsed.name === 'Bob' && parsed.age === 30 && parsed.ok === true && parsed.note === null &&
    Array.isArray(parsed.tags) && parsed.tags.length === 2;
})(), run('jsonRepair', messy).text);
t('修复报告修改处数', /修复 \d+ 处/.test(run('jsonRepair', messy).note), run('jsonRepair', messy).note);
t('修复去注释', (function () {
  const r = run('jsonRepair', '{"a": 1 /* 注释 */, "b": 2 // 行注释\n}');
  return JSON.parse(r.text).a === 1 && JSON.parse(r.text).b === 2;
})());
t('修复单引号内双引号', (function () {
  const r = run('jsonRepair', "{msg: 'say \"hi\"'}");
  return JSON.parse(r.text).msg === 'say "hi"';
})(), run('jsonRepair', "{msg: 'say \"hi\"'}").text);
t('修复裸键值列表补花括号', (function () {
  const r = run('jsonRepair', 'a: 1,\nb: 2');
  try { return JSON.parse(r.text).a === 1; } catch (e) { return false; }
})(), run('jsonRepair', 'a: 1,\nb: 2').text);

const arr = '[{"n":"a","v":1},{"n":"b","v":2}]';
t('提取所有键', run('jsonKeys', arr).text === 'n\nv' && run('jsonKeys', arr).note === '共 2 个唯一键',
  JSON.stringify(run('jsonKeys', arr)));
t('提取嵌套键去重', run('jsonKeys', '{"a":{"a":1,"b":2}}').text === 'a\nb');
t('提取路径', run('jsonPaths', '{"a":{"b":[1,2]}}').text === 'a.b[0] = 1\na.b[1] = 2',
  JSON.stringify(run('jsonPaths', '{"a":{"b":[1,2]}}').text));
t('对象数组转 CSV', (function () {
  const r = run('jsonToLines', '[{"a":1,"b":"x"},{"a":2,"b":"y,z"}]');
  return r.text.charCodeAt(0) === 0xFEFF && r.text.indexOf('"y,z"') !== -1;
})(), JSON.stringify(run('jsonToLines', '[{"a":1,"b":"x"},{"a":2,"b":"y,z"}]').text));
t('单对象也能转 CSV', run('jsonToLines', '{"a":1}').text.indexOf('a') !== -1);
t('嵌套数组拒绝转 CSV', run('jsonToLines', '[1,2]').note.indexOf('仅支持对象数组') !== -1);
t('非法 JSON 各操作都不崩', ['jsonKeys', 'jsonPaths', 'jsonToLines'].every(function (id) {
  return run(id, '{oops').note.indexOf('不是合法 JSON') !== -1;
}));

console.log('\n[7] 统计引擎');
const statText = 'Hello world. 你好，世界！\n\n第二段 has 3 numbers 123.';
const s = mod.computeStats(statText);
t('字符数（含空白）', s.chars === statText.length, s.chars + ' vs ' + statText.length);
t('字符数（不含空白）', s.charsNoSpace === statText.replace(/\s/g, '').length, s.charsNoSpace);
t('中文字数', s.chinese === 7, s.chinese);
t('英文单词数（含纯数字串）', s.words === 6, s.words);
t('行数', s.lines === 3, s.lines);
t('非空行数', s.nonEmptyLines === 2, s.nonEmptyLines);
t('段落数', s.paragraphs === 2, s.paragraphs);
t('句子数', s.sentences === 3, s.sentences);
t('数字字符数（"3" 与 "123" 共 4 位）', s.digits === 4, s.digits);
t('标点数 > 0', s.punctuation > 0, s.punctuation);
t('最长行', s.longestLine === Math.max.apply(null, statText.split('\n').map(l => l.length)), s.longestLine);
t('平均行长', Math.abs(s.avgLineLength - statText.length / 3) < 0.001, s.avgLineLength);
t('阅读时长 >= 1', s.readMinutes >= 1);
t('空文本统计零值', (function () {
  const z = mod.computeStats('');
  return z.chars === 0 && z.lines === 0 && z.paragraphs === 0 && z.longestLine === 0;
})());
t('统计操作可执行', run('stats', 'abc').text.indexOf('字符数') === 0, run('stats', 'abc').text.split('\n')[0]);
t('统计含 14 行', run('stats', 'abc').text.split('\n').length === 14, run('stats', 'abc').text.split('\n').length);

console.log('\n[8] 字符分布与词频');
const dist = mod.charDistribution('aA1中 文');
t('分布含中文/字母/数字/空白', dist.map(d => d.name).join(',').indexOf('中文') !== -1 &&
  dist.map(d => d.name).join(',').indexOf('字母') !== -1, JSON.stringify(dist.map(d => d.name)));
t('分布百分比合计约 100', Math.abs(dist.reduce((a, d) => a + d.percent, 0) - 100) < 0.01,
  dist.reduce((a, d) => a + d.percent, 0));
t('分布计数合计等于字符数', dist.reduce((a, d) => a + d.count, 0) === 'aA1中 文'.length);
t('空文本分布为空', mod.charDistribution('').length === 0);
const tw = mod.topWords('the quick fox the quick fox 中文文本测试 中文文本', 10);
t('词频过滤停用词 the', !tw.some(w => w.word === 'the'), JSON.stringify(tw));
t('词频含英文重复词', tw.some(w => w.word === 'quick' && w.count === 2), JSON.stringify(tw));
t('词频含中文二元组', tw.some(w => w.word === '中文' && w.count === 2), JSON.stringify(tw));
t('词频只保留出现 >1 次', tw.every(w => w.count > 1), JSON.stringify(tw));
t('词频按次数降序', tw.every((w, i) => i === 0 || tw[i - 1].count >= w.count));
t('词频受 limit 限制', mod.topWords('aa aa bb bb cc cc dd dd', 2).length === 2);
t('空文本词频为空', mod.topWords('').length === 0);

console.log('\n[9] 操作注册表完整性');
t('操作数量 >= 40', mod.OPERATIONS.length >= 40, mod.OPERATIONS.length);
const ids = mod.OPERATIONS.map(o => o.id);
t('操作 id 唯一', ids.length === new Set(ids).size, ids.filter((v, i) => ids.indexOf(v) !== i).join(','));
const cats = Array.from(new Set(mod.OPERATIONS.map(o => o.cat)));
t('分类齐全（6 类）', cats.sort().join(',') === 'case,encode,json,lines,stats,text', cats.join(','));
t('每个操作字段完整', mod.OPERATIONS.every(o => o.id && o.cat && o.name && o.icon && typeof o.run === 'function'),
  mod.OPERATIONS.filter(o => !(o.id && o.cat && o.name && o.icon)).map(o => o.id).join(','));
t('getOperation 能取到', mod.getOperation('upper') !== null && mod.getOperation('不存在') === null);
t('未知操作给提示', mod.applyOperation('nope', 'x').note.indexOf('未知操作') !== -1);

console.log('\n[10] 全体操作健壮性（空串 / 超长 / 特殊字符）');
let crash = [];
mod.OPERATIONS.forEach(function (op) {
  ['', '   ', '\n\n', '中文 English 123 !@#\n\t', '😀🚀', '```json\n{}\n```'].forEach(function (input) {
    try {
      const p = op.param !== undefined ? (op.param || '3') : undefined;
      const r = mod.applyOperation(op.id, input, p);
      if (typeof r.text !== 'string' || typeof r.note !== 'string') {
        crash.push(op.id + ' 返回值类型异常');
      }
    } catch (e) {
      crash.push(op.id + ' 抛错：' + e.message);
    }
  });
});
t('所有操作 × 6 种输入均不抛错', crash.length === 0, crash.join(' | '));
t('null 输入不崩', mod.applyOperation('upper', null).text === '');
t('undefined 输入不崩', mod.OPERATIONS.every(function (op) {
  try {
    mod.applyOperation(op.id, undefined, op.param);
    return true;
  } catch (e) { return false; }
}));

console.log('\n──────────────');
console.log('通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
