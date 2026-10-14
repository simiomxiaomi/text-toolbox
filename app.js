/* ==========================================================================
   Text Toolbox · app.js
   纯原生实现：文本处理操作引擎 + 统计
   零依赖、零构建。输入与偏好保存在 localStorage。
   ========================================================================== */
(function () {
  'use strict';

  /* =======================================================================
     一、基础工具（纯函数）
     ======================================================================= */

  /** 按 Unicode 码点切分，避免把 emoji / 生僻字劈成两半 */
  function splitChars(text) {
    var arr = Array.from ? Array.from(String(text)) : null;
    return arr || String(text).split('');
  }

  function reEscape(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** 统一换行符并返回行数组（保留空行） */
  function toLines(text) {
    return String(text).replace(/\r\n?/g, '\n').split('\n');
  }

  function countLines(text) {
    if (text === '') return 0;
    return toLines(text).length;
  }

  function isBlankLine(line) {
    return /^\s*$/.test(line);
  }

  function toTitleCase(text) {
    return String(text).replace(/\b([A-Za-z])([A-Za-z'’]*)/g, function (m, first, rest) {
      return first.toUpperCase() + rest.toLowerCase();
    });
  }

  function toCamelCase(text) {
    var words = String(text).split(/[^A-Za-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
    if (!words.length) return '';
    return words.map(function (w, i) {
      var lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join('');
  }

  function toPascalCase(text) {
    var camel = toCamelCase(text);
    return camel ? camel.charAt(0).toUpperCase() + camel.slice(1) : '';
  }

  function toSnakeCase(text) {
    return String(text)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .split(/[^A-Za-z0-9\u4e00-\u9fa5]+/)
      .filter(Boolean)
      .map(function (w) { return w.toLowerCase(); })
      .join('_');
  }

  function toKebabCase(text) {
    return toSnakeCase(text).replace(/_/g, '-');
  }

  /** 用 base64 做 UTF-8 安全的编解码 */
  function base64Encode(text) {
    var bytes = unescape(encodeURIComponent(String(text)));
    return btoa(bytes);
  }

  function base64Decode(text) {
    var clean = String(text).replace(/\s+/g, '');
    var padded = clean + '='.repeat((4 - clean.length % 4) % 4);
    return decodeURIComponent(escape(atob(padded)));
  }

  function isBase64(text) {
    var clean = String(text).replace(/\s+/g, '');
    if (!clean) return false;
    if (clean.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return false;
    try {
      base64Decode(clean);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 从 URL 里还原已编码的文本（非法或截断的百分号序列保持原样） */
  function urlDecodeSmart(text) {
    var s = String(text);
    var out = '';

    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch !== '%') { out += ch; continue; }

      // 尽量多吃连续的 %xx 字节
      var bytes = [];
      var j = i;
      while (j + 2 < s.length && s.charAt(j) === '%' && /^[0-9A-Fa-f]{2}$/.test(s.substr(j + 1, 2))) {
        bytes.push(s.substr(j, 3));
        j += 3;
      }

      if (bytes.length) {
        var decoded = null;
        // 从最长序列开始尝试，失败就砍掉尾巴，直到剩下的能正常解码
        for (var take = bytes.length; take > 0; take--) {
          try {
            decoded = decodeURIComponent(bytes.slice(0, take).join(''));
            break;
          } catch (e) {
            decoded = null;
          }
        }
        if (decoded !== null) {
          out += decoded;
          i = i + take * 3 - 1;
          continue;
        }
      }

      out += ch;
    }
    return out;
  }

  function htmlEscape(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
    laquo: '«', raquo: '»', middot: '·', deg: '°', times: '×', divide: '÷',
    plusmn: '±', frac12: '½', sup2: '²', sup3: '³', lsquo: '\u2018', rsquo: '\u2019',
    ldquo: '\u201c', rdquo: '\u201d', bull: '•', dagger: '†', permil: '‰',
    euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', micro: 'µ'
  };

  function htmlUnescape(text) {
    return String(text).replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/g, function (m, body) {
      if (body.charAt(0) === '#') {
        var isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
        var code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
        if (!isFinite(code) || code < 0 || code > 0x10FFFF) return m;
        try {
          return String.fromCodePoint(code);
        } catch (e) {
          return m;
        }
      }
      var lower = body.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower) ? NAMED_ENTITIES[lower] : m;
    });
  }

  /** 生成 slug：保留中英文与数字，其余转连字符 */
  function slugify(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .replace(/['"’“”]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * JSON 自动修复：
   * 去尾逗号、单引号转双引号、无引号 key 补引号、一行一值补包裹、去注释
   */
  function repairJson(text) {
    var src = String(text);
    var out = '';
    var i = 0;
    var inString = false;
    var quote = '';
    var changes = 0;

    while (i < src.length) {
      var c = src.charAt(i);
      var next = src.charAt(i + 1);

      if (inString) {
        if (c === '\\') {
          out += c + (next || '');
          i += 2;
          continue;
        }
        if (c === quote) {
          inString = false;
          out += '"';
          if (quote !== '"') changes++;
          i++;
          continue;
        }
        out += (c === '"' && quote !== '"') ? '\\"' : c;
        i++;
        continue;
      }

      /* ---- 不在字符串内 ---- */

      /* 注释 */
      if (c === '/' && next === '/') {
        while (i < src.length && src.charAt(i) !== '\n') i++;
        changes++;
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < src.length && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) i++;
        i += 2;
        changes++;
        continue;
      }

      /* 引号：单引号统一转双引号（内部双引号会被转义） */
      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        if (c === "'") changes++;
        out += '"';
        i++;
        continue;
      }

      /* 无引号 key / 类 Python 字面量：先回望判断是否处在「键」的位置 */
      if (/[A-Za-z_$]/.test(c)) {
        var start = i;
        while (i < src.length && /[\w$.-]/.test(src.charAt(i))) i++;
        var word = src.slice(start, i);
        var k = i;
        while (k < src.length && /\s/.test(src.charAt(k))) k++;
        var isKeyPosition = (function () {
          var p = out.length - 1;
          while (p >= 0 && /\s/.test(out.charAt(p))) p--;
          return p < 0 || out.charAt(p) === '{' || out.charAt(p) === ',';
        })();

        if (word === 'True' || word === 'False') {
          out += word === 'True' ? 'true' : 'false';
          changes++;
        } else if (word === 'None' || word === 'NaN' || word === 'undefined') {
          out += 'null';
          changes++;
        } else if (isKeyPosition && src.charAt(k) === ':') {
          out += '"' + word + '"';
          changes++;
        } else {
          out += word;
        }
        continue;
      }

      // 尾随逗号：,  后面是 } 或 ]
      if (c === ',') {
        var t = i + 1;
        while (t < src.length && /\s/.test(src.charAt(t))) t++;
        if (src.charAt(t) === '}' || src.charAt(t) === ']') {
          changes++;
          i++;
          continue;
        }
      }

      out += c;
      i++;
    }

    // 形如 key: value 的裸键值列表（整体没有花括号）→ 补花括号
    var trimmed = out.trim();
    if (trimmed && trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[' &&
        /^\s*"[\w$.-]+"\s*:/.test(trimmed)) {
      out = '{\n' + out.trim().replace(/,\s*$/, '') + '\n}';
      changes++;
    }

    return { text: out, changes: changes };
  }

  /* =======================================================================
     二、处理操作
     ======================================================================= */

  function same(text) {
    return { text: text, note: '' };
  }

  var OPERATIONS = [
    /* ---------------- 大小写 ---------------- */
    { id: 'upper', cat: 'case', name: '全部大写', icon: 'AA', run: function (t) { return same(t.toUpperCase()); } },
    { id: 'lower', cat: 'case', name: '全部小写', icon: 'aa', run: function (t) { return same(t.toLowerCase()); } },
    { id: 'title', cat: 'case', name: '词首大写', icon: 'Aa', run: function (t) { return same(toTitleCase(t)); } },
    { id: 'sentence', cat: 'case', name: '句首大写', icon: 'A.', run: function (t) {
      return same(t.toLowerCase().replace(/(^\s*|[.!?。！？]\s+)([a-z])/g, function (m, p, ch) { return p + ch.toUpperCase(); }));
    } },
    { id: 'camel', cat: 'case', name: 'camelCase', icon: 'cC', run: function (t) { return same(toCamelCase(t)); } },
    { id: 'pascal', cat: 'case', name: 'PascalCase', icon: 'PC', run: function (t) { return same(toPascalCase(t)); } },
    { id: 'snake', cat: 'case', name: 'snake_case', icon: 's_c', run: function (t) { return same(toSnakeCase(t)); } },
    { id: 'kebab', cat: 'case', name: 'kebab-case', icon: 'k-b', run: function (t) { return same(toKebabCase(t)); } },
    { id: 'invert', cat: 'case', name: '大小写反转', icon: 'aB', run: function (t) {
      return same(splitChars(t).map(function (ch) {
        var up = ch.toUpperCase(), lo = ch.toLowerCase();
        if (ch === up && ch !== lo) return lo;
        if (ch === lo && ch !== up) return up;
        return ch;
      }).join(''));
    } },

    /* ---------------- 文本 ---------------- */
    { id: 'trimLines', cat: 'text', name: '去首尾空白', icon: '⇥', run: function (t) {
      return same(t.split('\n').map(function (l) { return l.replace(/^\s+|\s+$/g, ''); }).join('\n'));
    } },
    { id: 'collapseSpace', cat: 'text', name: '连续空格压成一个', icon: '␣', run: function (t) {
      return same(t.replace(/[ \t]{2,}/g, ' '));
    } },
    { id: 'stripAllSpace', cat: 'text', name: '删除所有空白', icon: '␡', run: function (t) {
      return same(t.replace(/\s+/g, ''));
    } },
    { id: 'removeEmptyLines', cat: 'text', name: '删除空行', icon: '␊', run: function (t) {
      var lines = toLines(t);
      var kept = lines.filter(function (l) { return !isBlankLine(l); });
      return { text: kept.join('\n'), note: '删除 ' + (lines.length - kept.length) + ' 行空行' };
    } },
    { id: 'removeIndent', cat: 'text', name: '删除行首缩进', icon: '⇤', run: function (t) {
      return same(toLines(t).map(function (l) { return l.replace(/^[\t ]+/, ''); }).join('\n'));
    } },
    { id: 'removeNumbers', cat: 'text', name: '删除所有数字', icon: '№', run: function (t) {
      return same(t.replace(/\d/g, ''));
    } },
    { id: 'removePunct', cat: 'text', name: '删除标点', icon: '¶', run: function (t) {
      return same(t.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~，。！？、；：""''（）【】《》…—]/g, ''));
    } },
    { id: 'removeSpecial', cat: 'text', name: '仅保留中英数字', icon: '✂', run: function (t) {
      return same(t.replace(/[^\u4e00-\u9fa5A-Za-z0-9\s]/g, ''));
    } },
    { id: 'zh2enPunct', cat: 'text', name: '中文标点转英文', icon: '，.', run: function (t) {
      var map = { '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',', '（': '(', '）': ')', '【': '[', '】': ']', '“': '"', '”': '"', '‘': "'", '’': "'", '《': '<', '》': '>', '—': '-', '…': '...' };
      return same(splitChars(t).map(function (ch) { return map[ch] !== undefined ? map[ch] : ch; }).join(''));
    } },
    { id: 'normalizeNewline', cat: 'text', name: '统一换行符', icon: '↵', run: function (t) {
      return same(String(t).replace(/\r\n?/g, '\n'));
    } },
    { id: 'replace', cat: 'text', name: '查找替换', icon: '⇄', param: '留空则不替换', paramHint: '旧文本|新文本', run: function (t, p) {
      var raw = String(p || '');
      if (raw.indexOf('|') === -1) return { text: t, note: '参数格式：旧文本|新文本' };
      var idx = raw.indexOf('|');
      var from = raw.slice(0, idx);
      var to = raw.slice(idx + 1);
      if (!from) return { text: t, note: '旧文本不能为空' };
      var count = t.split(from).length - 1;
      var out = t.split(from).join(to);
      return { text: out, note: '替换 ' + count + ' 处' };
    } },
    { id: 'wrapWidth', cat: 'text', name: '按宽度折行', icon: '↩', param: '40', paramHint: '每行最大字符数', run: function (t, p) {
      var width = parseInt(p, 10);
      if (!isFinite(width) || width < 1) width = 40;
      var out = toLines(t).map(function (line) {
        if (line.length <= width) return line;
        var parts = [];
        for (var i = 0; i < line.length; i += width) parts.push(line.slice(i, i + width));
        return parts.join('\n');
      }).join('\n');
      return { text: out, note: '按 ' + width + ' 字符折行' };
    } },

    /* ---------------- 行处理 ---------------- */
    { id: 'sortAsc', cat: 'lines', name: '升序排序', icon: '↑', run: function (t) {
      return same(toLines(t).slice().sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }).join('\n'));
    } },
    { id: 'sortDesc', cat: 'lines', name: '降序排序', icon: '↓', run: function (t) {
      return same(toLines(t).slice().sort(function (a, b) { return b.localeCompare(a, 'zh-CN'); }).join('\n'));
    } },
    { id: 'sortLen', cat: 'lines', name: '按长度排序', icon: '↕', run: function (t) {
      return same(toLines(t).slice().sort(function (a, b) {
        return a.trim().length - b.trim().length || a.localeCompare(b, 'zh-CN');
      }).join('\n'));
    } },
    { id: 'sortNum', cat: 'lines', name: '按数值排序', icon: '#↑', run: function (t) {
      var lines = toLines(t);
      var allNum = lines.filter(function (l) { return l.trim() !== ''; }).every(function (l) { return !isNaN(parseFloat(l.trim())); });
      if (!allNum) return { text: t, note: '存在非数字行，无法按数值排序' };
      return same(lines.slice().sort(function (a, b) {
        var x = parseFloat(a), y = parseFloat(b);
        if (isNaN(x)) return 1;
        if (isNaN(y)) return -1;
        return x - y;
      }).join('\n'));
    } },
    { id: 'reverseLines', cat: 'lines', name: '行顺序反转', icon: '⇅', run: function (t) {
      return same(toLines(t).slice().reverse().join('\n'));
    } },
    { id: 'dedupe', cat: 'lines', name: '去重（保序）', icon: '⊕', run: function (t) {
      var lines = toLines(t);
      var seen = {};
      var out = [];
      var removed = 0;
      lines.forEach(function (l) {
        var key = l;
        if (Object.prototype.hasOwnProperty.call(seen, key)) { removed++; return; }
        seen[key] = 1;
        out.push(l);
      });
      return { text: out.join('\n'), note: '移除 ' + removed + ' 行重复' };
    } },
    { id: 'dedupeTrim', cat: 'lines', name: '去重（忽略首尾空格）', icon: '⊕', run: function (t) {
      var lines = toLines(t);
      var seen = {};
      var out = [];
      var removed = 0;
      lines.forEach(function (l) {
        var key = l.trim();
        if (Object.prototype.hasOwnProperty.call(seen, key)) { removed++; return; }
        seen[key] = 1;
        out.push(l);
      });
      return { text: out.join('\n'), note: '移除 ' + removed + ' 行重复' };
    } },
    { id: 'shuffle', cat: 'lines', name: '随机打乱', icon: '🎲', run: function (t) {
      var lines = toLines(t);
      for (var i = lines.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = lines[i]; lines[i] = lines[j]; lines[j] = tmp;
      }
      return same(lines.join('\n'));
    } },
    { id: 'numberLines', cat: 'lines', name: '添加行号', icon: '1.', run: function (t) {
      var lines = toLines(t);
      var width = String(lines.length).length;
      var out = lines.map(function (l, i) {
        var n = String(i + 1);
        while (n.length < width) n = ' ' + n;
        return n + '. ' + l;
      }).join('\n');
      return { text: out, note: '共 ' + lines.length + ' 行' };
    } },
    { id: 'removeLineNo', cat: 'lines', name: '移除行号', icon: '1x', run: function (t) {
      return same(toLines(t).map(function (l) { return l.replace(/^\s*\d+[.、)]\s?/, ''); }).join('\n'));
    } },

    /* ---------------- 编码 ---------------- */
    { id: 'base64Encode', cat: 'encode', name: 'Base64 编码', icon: '↑B', run: function (t) {
      try {
        return { text: base64Encode(t), note: 'UTF-8 → Base64' };
      } catch (e) {
        return { text: t, note: '编码失败：' + e.message };
      }
    } },
    { id: 'base64Decode', cat: 'encode', name: 'Base64 解码', icon: '↓B', run: function (t) {
      try {
        return { text: base64Decode(t), note: 'Base64 → UTF-8' };
      } catch (e) {
        return { text: t, note: '解码失败：内容不是合法的 Base64' };
      }
    } },
    { id: 'urlEncode', cat: 'encode', name: 'URL 编码', icon: '%↑', run: function (t) {
      return { text: encodeURIComponent(t), note: 'encodeURIComponent' };
    } },
    { id: 'urlDecode', cat: 'encode', name: 'URL 解码', icon: '%↓', run: function (t) {
      return { text: urlDecodeSmart(t), note: 'decodeURIComponent' };
    } },
    { id: 'htmlEscape', cat: 'encode', name: 'HTML 转义', icon: '<&', run: function (t) {
      return { text: htmlEscape(t), note: '特殊字符 → 实体' };
    } },
    { id: 'htmlUnescape', cat: 'encode', name: 'HTML 反转义', icon: '&<', run: function (t) {
      return { text: htmlUnescape(t), note: '实体 → 字符（含数字实体）' };
    } },
    { id: 'slugify', cat: 'encode', name: '生成 URL slug', icon: '🔗', run: function (t) {
      return { text: slugify(t), note: '保留中英文数字' };
    } },
    { id: 'charCodes', cat: 'encode', name: '转字符码', icon: '#', run: function (t) {
      return { text: splitChars(t).map(function (ch) { return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'); }).join(' '), note: '按 Unicode 码点' };
    } },
    { id: 'toHex', cat: 'encode', name: '转十六进制', icon: '0x', run: function (t) {
      var bytes = unescape(encodeURIComponent(t));
      return { text: Array.prototype.map.call(bytes, function (c) {
        return c.charCodeAt(0).toString(16).padStart(2, '0');
      }).join(' '), note: 'UTF-8 字节序列' };
    } },
    { id: 'fromHex', cat: 'encode', name: '十六进制转文本', icon: '0d', run: function (t) {
      var clean = String(t).replace(/[^0-9A-Fa-f]/g, '');
      if (!clean) return { text: '', note: '没有可解析的十六进制' };
      if (clean.length % 2 !== 0) clean = clean.slice(0, clean.length - 1);
      var pairs = clean.match(/../g) || [];
      try {
        var decoded = decodeURIComponent(pairs.map(function (p) { return '%' + p; }).join(''));
        return { text: decoded, note: '按 UTF-8 解码 ' + pairs.length + ' 字节' };
      } catch (e) {
        return { text: pairs.join(' '), note: '字节序列不是合法 UTF-8，已按字节展示' };
      }
    } },
    { id: 'jsonStringify', cat: 'encode', name: '转 JSON 字符串字面量', icon: '"', run: function (t) {
      return { text: JSON.stringify(t), note: '含首尾引号' };
    } },

    /* ---------------- JSON ---------------- */
    { id: 'jsonFormat4', cat: 'json', name: '格式化（2 空格）', icon: '{ }', run: function (t) { return jsonFormat(t, 2); } },
    { id: 'jsonFormatTab', cat: 'json', name: '格式化（Tab）', icon: '{→}', run: function (t) { return jsonFormat(t, '\t'); } },
    { id: 'jsonMinify', cat: 'json', name: '压缩', icon: '{}', run: function (t) {
      try {
        return { text: JSON.stringify(JSON.parse(t)), note: '已移除全部空白' };
      } catch (e) {
        return { text: t, note: '不是合法 JSON：' + e.message };
      }
    } },
    { id: 'jsonRepair', cat: 'json', name: '自动修复', icon: '🔧', run: function (t) {
      var repaired = repairJson(t);
      try {
        var parsed = JSON.parse(repaired.text);
        return {
          text: JSON.stringify(parsed, null, 2),
          note: '修复 ' + repaired.changes + ' 处，已解析成功'
        };
      } catch (e) {
        return { text: repaired.text, note: '修复 ' + repaired.changes + ' 处，但仍无法解析：' + e.message };
      }
    } },
    { id: 'jsonKeys', cat: 'json', name: '提取所有键', icon: '🔑', run: function (t) {
      var parsed = tryParse(t);
      if (!parsed.ok) return { text: t, note: '不是合法 JSON：' + parsed.error };
      var keys = [];
      var seen = {};
      (function walk(node) {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node && typeof node === 'object') {
          Object.keys(node).forEach(function (k) {
            if (!seen[k]) { seen[k] = 1; keys.push(k); }
            walk(node[k]);
          });
        }
      })(parsed.value);
      keys.sort();
      return { text: keys.join('\n'), note: '共 ' + keys.length + ' 个唯一键' };
    } },
    { id: 'jsonPaths', cat: 'json', name: '提取所有路径', icon: '🗺', run: function (t) {
      var parsed = tryParse(t);
      if (!parsed.ok) return { text: t, note: '不是合法 JSON：' + parsed.error };
      var out = [];
      (function walk(node, path) {
        if (Array.isArray(node)) {
          node.forEach(function (v, i) { walk(v, path + '[' + i + ']'); });
          return;
        }
        if (node && typeof node === 'object') {
          Object.keys(node).forEach(function (k) {
            walk(node[k], path ? path + '.' + k : k);
          });
          return;
        }
        out.push(path + ' = ' + JSON.stringify(node));
      })(parsed.value, '');
      return { text: out.join('\n'), note: '共 ' + out.length + ' 个叶子节点' };
    } },
    { id: 'jsonToLines', cat: 'json', name: '转 CSV（一层对象）', icon: '⇢', run: function (t) {
      var parsed = tryParse(t);
      if (!parsed.ok) return { text: t, note: '不是合法 JSON：' + parsed.error };
      var rows = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
      if (!rows.every(function (r) { return r && typeof r === 'object' && !Array.isArray(r); })) {
        return { text: t, note: '仅支持对象数组（或单个对象）' };
      }
      var keys = [];
      rows.forEach(function (r) {
        Object.keys(r).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
      });
      var lines = [keys.map(csvCell).join(',')];
      rows.forEach(function (r) {
        lines.push(keys.map(function (k) { return csvCell(r[k]); }).join(','));
      });
      return { text: '\uFEFF' + lines.join('\r\n'), note: rows.length + ' 行 × ' + keys.length + ' 列（带 BOM）' };
    } },

    /* ---------------- 统计 ---------------- */
    { id: 'stats', cat: 'stats', name: '统计到结果区', icon: 'Σ', run: function (t) {
      var s = computeStats(t);
      var lines = [
        '字符数（含空白）：' + s.chars,
        '字符数（不含空白）：' + s.charsNoSpace,
        '中文字数：' + s.chinese,
        '英文单词：' + s.words,
        '行数：' + s.lines,
        '非空行：' + s.nonEmptyLines,
        '段落数：' + s.paragraphs,
        '句子数：' + s.sentences,
        '数字字数：' + s.digits,
        '标点数：' + s.punctuation,
        '最长行：' + s.longestLine + ' 字符',
        '平均行长：' + s.avgLineLength.toFixed(1) + ' 字符',
        '预计阅读：约 ' + s.readMinutes + ' 分钟',
        '预计朗读：约 ' + s.speakMinutes + ' 分钟'
      ];
      return { text: lines.join('\n'), note: '统计结果已输出' };
    } }
  ];

  function jsonFormat(text, indent) {
    try {
      return { text: JSON.stringify(JSON.parse(text), null, indent), note: indent === '\t' ? 'Tab 缩进' : indent + ' 空格缩进' };
    } catch (e) {
      return { text: text, note: '不是合法 JSON：' + e.message };
    }
  }

  function tryParse(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function getOperation(id) {
    for (var i = 0; i < OPERATIONS.length; i++) {
      if (OPERATIONS[i].id === id) return OPERATIONS[i];
    }
    return null;
  }

  function applyOperation(id, text, param) {
    var op = getOperation(id);
    if (!op) return { text: text, note: '未知操作：' + id };
    var input = text == null ? '' : String(text);
    var result = op.run(input, param);
    return {
      text: result.text,
      note: result.note || '',
      name: op.name
    };
  }

  /* =======================================================================
     三、统计引擎
     ======================================================================= */
  var STOP_WORDS = (function () {
    var s = {};
    ('the a an and or but if then else of to in on at by for with from as is are was were be been being ' +
     'this that these those it its i you he she we they them his her their our your my me us ' +
     'do does did done have has had will would can could should may might must not no yes ' +
     '的 了 和 与 是 在 有 我 你 他 她 它 们 这 那 也 就 都 而 及 或 如果 因为 所以').split(/\s+/).forEach(function (w) {
      if (w) s[w] = 1;
    });
    return s;
  })();

  function computeStats(text) {
    var s = String(text == null ? '' : text);
    var chars = s.length;
    var charsNoSpace = s.replace(/\s/g, '').length;
    var chinese = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    var latinWords = (s.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_']+/g) || []).length;
    var digits = (s.match(/\d/g) || []).length;
    var punctuation = (s.match(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~，。！？、；：""''（）【】《》…—]/g) || []).length;
    var lines = s === '' ? 0 : toLines(s).length;
    var lineArr = s === '' ? [] : toLines(s);
    var nonEmptyLines = lineArr.filter(function (l) { return !isBlankLine(l); }).length;
    var paragraphs = s.trim() === '' ? 0 : s.trim().split(/\n\s*\n+/).filter(function (p) { return p.trim() !== ''; }).length;
    var sentences = (s.match(/[^.!?。！？\n]+[.!?。！？]/g) || []).length || (s.trim() ? 1 : 0);
    var longestLine = lineArr.reduce(function (max, l) { return Math.max(max, l.length); }, 0);
    var avgLineLength = lineArr.length ? chars / lineArr.length : 0;
    var words = chinese + latinWords;
    var readMinutes = Math.max(1, Math.round(words / 300));
    var speakMinutes = Math.max(1, Math.round(words / 200));

    return {
      chars: chars,
      charsNoSpace: charsNoSpace,
      chinese: chinese,
      words: latinWords,
      totalWords: words,
      digits: digits,
      punctuation: punctuation,
      lines: lines,
      nonEmptyLines: nonEmptyLines,
      paragraphs: paragraphs,
      sentences: sentences,
      longestLine: longestLine,
      avgLineLength: avgLineLength,
      readMinutes: readMinutes,
      speakMinutes: speakMinutes
    };
  }

  /** 字符类型分布（百分比） */
  function charDistribution(text) {
    var s = String(text == null ? '' : text);
    var total = s.length;
    var buckets = [
      { name: '中文', test: function (ch) { return /[\u4e00-\u9fa5]/.test(ch); } },
      { name: '字母', test: function (ch) { return /[A-Za-z]/.test(ch); } },
      { name: '数字', test: function (ch) { return /[0-9]/.test(ch); } },
      { name: '空白', test: function (ch) { return /\s/.test(ch); } },
      { name: '标点', test: function (ch) { return /[!-/:-@[-`{-~，。！？、；：""''（）【】《》…—]/.test(ch); } }
    ];
    var counts = buckets.map(function (b) { return { name: b.name, count: 0 }; });
    var other = 0;

    splitChars(s).forEach(function (ch) {
      for (var i = 0; i < buckets.length; i++) {
        if (buckets[i].test(ch)) { counts[i].count++; return; }
      }
      other++;
    });
    if (other) counts.push({ name: '其他', count: other });

    return counts
      .filter(function (c) { return c.count > 0; })
      .map(function (c) {
        return { name: c.name, count: c.count, percent: total ? c.count / total * 100 : 0 };
      })
      .sort(function (a, b) { return b.count - a.count; });
  }

  /** 词频 Top N：中文按二元组近似，英文按单词 */
  function topWords(text, limit) {
    var n = limit || 15;
    var s = String(text == null ? '' : text);
    var counts = {};
    var order = [];

    function add(word) {
      if (!word) return;
      if (!Object.prototype.hasOwnProperty.call(counts, word)) { counts[word] = 0; order.push(word); }
      counts[word]++;
    }

    // 英文单词
    (s.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z][A-Za-z0-9_'-]{1,}/g) || []).forEach(function (w) {
      var lower = w.toLowerCase();
      if (STOP_WORDS[lower]) return;
      add(lower);
    });

    // 中文二元组
    var cnRuns = s.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    cnRuns.forEach(function (run) {
      var chars = splitChars(run);
      for (var i = 0; i + 1 < chars.length; i++) {
        var bigram = chars[i] + chars[i + 1];
        if (STOP_WORDS[bigram]) continue;
        add(bigram);
      }
    });

    return order
      .map(function (w) { return { word: w, count: counts[w] }; })
      .filter(function (w) { return w.count > 1; })
      .sort(function (a, b) { return b.count - a.count || a.word.localeCompare(b.word); })
      .slice(0, n);
  }

  /* ---ENGINE-END--- */

  /* =======================================================================
     四、DOM 层
     ======================================================================= */
  var $ = function (sel) { return document.querySelector(sel); };

  var els = {
    catTabs: $('#catTabs'),
    opList: $('#opList'),
    opExtra: $('#opExtra'),
    opExtraLabel: $('#opExtraLabel'),
    opParam: $('#opParam'),
    opApply: $('#opApply'),
    opCancel: $('#opCancel'),
    input: $('#input'),
    output: $('#output'),
    inStat: $('#inStat'),
    outStat: $('#outStat'),
    outBadge: $('#outBadge'),
    statGrid: $('#statGrid'),
    distList: $('#distList'),
    wordList: $('#wordList'),
    statTarget: $('#statTarget'),
    statusOp: $('#statusOp'),
    statusIn: $('#statusIn'),
    statusOut: $('#statusOut'),
    undoBtn: $('#undoBtn'),
    openBtn: $('#openBtn'),
    sampleBtn: $('#sampleBtn'),
    clearBtn: $('#clearBtn'),
    fileInput: $('#fileInput'),
    inPasteBtn: $('#inPasteBtn'),
    inClearBtn: $('#inClearBtn'),
    outCopyBtn: $('#outCopyBtn'),
    outUseBtn: $('#outUseBtn'),
    outDownloadBtn: $('#outDownloadBtn'),
    toast: $('#toast')
  };

  var KEYS = {
    input: 'text-toolbox:input',
    cat: 'text-toolbox:cat',
    history: 'text-toolbox:history'
  };

  var state = {
    cat: 'case',
    pendingOp: null,
    history: [],
    toastTimer: 0,
    hasOutput: false
  };

  var SAMPLE = [
    'Hello World, this is a SAMPLE text.',
    '',
    '  前面有空格的这一行  ',
    '重复的内容',
    '重复的内容',
    '重复的内容',
    '',
    'the quick brown fox jumps over the lazy dog',
    'the quick brown fox',
    '',
    '订单号: 2026-1014',
    '数量: 3',
    '单价: 19.9',
    '',
    '中文测试：这是一段用来测试统计与分词的中文文本，中文文本测试。',
    '中文文本，用来测试二元组分词效果。',
    ''
  ].join('\n');

  /* ---------- 存储 ---------- */
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式 */ }
  }
  function load(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      els.toast.classList.remove('is-show');
    }, 1600);
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMsg || '已复制');
      }, function () { fallbackCopy(text, okMsg); });
    } else {
      fallbackCopy(text, okMsg);
    }
  }
  function fallbackCopy(text, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? (okMsg || '已复制') : '复制失败，请手动选择');
  }

  /* ---------- 渲染操作按钮 ---------- */
  function renderOps() {
    var list = OPERATIONS.filter(function (op) { return op.cat === state.cat; });
    var frag = document.createDocumentFragment();
    list.forEach(function (op) {
      var btn = document.createElement('button');
      btn.className = 'op-btn';
      btn.type = 'button';
      btn.setAttribute('data-op', op.id);
      btn.title = op.name + (op.paramHint ? '（需要参数：' + op.paramHint + '）' : '');

      var icon = document.createElement('span');
      icon.className = 'op-icon';
      icon.textContent = op.icon;
      var name = document.createElement('span');
      name.textContent = op.name;

      btn.appendChild(icon);
      btn.appendChild(name);
      frag.appendChild(btn);
    });
    els.opList.textContent = '';
    els.opList.appendChild(frag);
  }

  function setCat(cat) {
    state.cat = cat;
    save(KEYS.cat, cat);
    Array.prototype.forEach.call(els.catTabs.querySelectorAll('.tab'), function (t) {
      var on = t.getAttribute('data-cat') === cat;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    hideParam();
    renderOps();
  }

  function showParam(op) {
    state.pendingOp = op;
    els.opExtra.hidden = false;
    els.opExtraLabel.textContent = op.name + '：';
    els.opParam.placeholder = op.paramHint || '参数';
    els.opParam.value = op.param || '';
    els.opParam.focus();
    els.opParam.select();
  }
  function hideParam() {
    state.pendingOp = null;
    els.opExtra.hidden = true;
    els.opParam.value = '';
  }

  /* ---------- 执行 ---------- */
  function runOp(opId, param) {
    var before = els.output.value;
    var result = applyOperation(opId, els.input.value, param);

    if (result.text === before && state.hasOutput) {
      // 输出没变，不重复记录
    } else {
      state.history.push(before);
      if (state.history.length > 30) state.history.shift();
      els.output.value = result.text;
      state.hasOutput = true;
    }

    els.undoBtn.disabled = state.history.length === 0;
    els.statusOp.textContent = result.name + (result.note ? ' · ' + result.note : '');
    els.statusOp.classList.add('is-active');
    els.outBadge.hidden = true;
    els.outBadge.textContent = '';

    updateOutputStat();
    if (result.note) toast(result.name + '：' + result.note);
    else toast(result.name + ' 完成');
  }

  function updateOutputStat() {
    var out = els.output.value;
    els.outStat.textContent = out.length + ' 字符 · ' + (out ? out.split('\n').length : 0) + ' 行';
    els.statusOut.textContent = '输出 ' + out.length + ' 字符';
  }

  function updateInputStat() {
    var text = els.input.value;
    els.inStat.textContent = text.length + ' 字符 · ' + (text ? text.split('\n').length : 0) + ' 行';
    els.statusIn.textContent = '输入 ' + text.length + ' 字符';
    renderStats(text);
  }

  /* ---------- 统计渲染 ---------- */
  function renderStats(text) {
    var s = computeStats(text);
    els.statTarget.textContent = '当前输入 · ' + s.chars + ' 字符';

    var cards = [
      { label: '字符（含空白）', value: s.chars },
      { label: '字符（不含空白）', value: s.charsNoSpace, accent: true },
      { label: '中文', value: s.chinese },
      { label: '英文单词', value: s.words },
      { label: '行数', value: s.lines },
      { label: '非空行', value: s.nonEmptyLines },
      { label: '段落', value: s.paragraphs },
      { label: '句子', value: s.sentences },
      { label: '数字字符', value: s.digits },
      { label: '标点', value: s.punctuation },
      { label: '最长行', value: s.longestLine },
      { label: '平均行长', value: s.avgLineLength.toFixed(1) }
    ];

    var frag = document.createDocumentFragment();
    cards.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'stat-card' + (c.accent ? ' accent' : '');
      var v = document.createElement('span');
      v.className = 'sc-value';
      v.textContent = String(c.value);
      var l = document.createElement('span');
      l.className = 'sc-label';
      l.textContent = c.label;
      card.appendChild(v);
      card.appendChild(l);
      frag.appendChild(card);
    });
    els.statGrid.textContent = '';
    els.statGrid.appendChild(frag);

    /* 字符分布 */
    var dist = charDistribution(text);
    var dFrag = document.createDocumentFragment();
    if (!dist.length) {
      var note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = '输入文本后这里显示各类字符的占比';
      dFrag.appendChild(note);
    } else {
      dist.forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'dist-row';
        var name = document.createElement('span');
        name.className = 'dr-name';
        name.textContent = d.name;
        var bar = document.createElement('span');
        bar.className = 'dr-bar';
        var fill = document.createElement('span');
        fill.className = 'dr-fill';
        fill.style.width = Math.max(2, d.percent) + '%';
        bar.appendChild(fill);
        var num = document.createElement('span');
        num.className = 'dr-num';
        num.textContent = d.count + ' · ' + d.percent.toFixed(1) + '%';
        row.appendChild(name);
        row.appendChild(bar);
        row.appendChild(num);
        dFrag.appendChild(row);
      });
    }
    els.distList.textContent = '';
    els.distList.appendChild(dFrag);

    /* 高频词 */
    var words = topWords(text, 15);
    var wFrag = document.createDocumentFragment();
    if (!words.length) {
      var wNote = document.createElement('div');
      wNote.className = 'empty-note';
      wNote.textContent = '重复出现的词（≥2 次）会列在这里，点击可复制';
      wFrag.appendChild(wNote);
    } else {
      words.forEach(function (w) {
        var row = document.createElement('div');
        row.className = 'word-row';
        row.setAttribute('data-copy', w.word);
        row.title = '点击复制「' + w.word + '」';
        var word = document.createElement('span');
        word.className = 'wr-word';
        word.textContent = w.word;
        var count = document.createElement('span');
        count.className = 'wr-count';
        count.textContent = '×' + w.count;
        row.appendChild(word);
        row.appendChild(count);
        wFrag.appendChild(row);
      });
    }
    els.wordList.textContent = '';
    els.wordList.appendChild(wFrag);
  }

  /* ---------- 撤销 ---------- */
  function undo() {
    if (!state.history.length) { toast('没有可撤销的操作'); return; }
    els.output.value = state.history.pop();
    els.undoBtn.disabled = state.history.length === 0;
    updateOutputStat();
    els.statusOp.textContent = '已撤销';
    els.statusOp.classList.remove('is-active');
    toast('已撤销');
  }

  /* ---------- 下载 ---------- */
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  /* =======================================================================
     五、事件绑定
     ======================================================================= */
  function bind() {
    els.catTabs.addEventListener('click', function (ev) {
      var tab = ev.target.closest('.tab');
      if (tab) setCat(tab.getAttribute('data-cat'));
    });

    els.opList.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-op]');
      if (!btn) return;
      var op = getOperation(btn.getAttribute('data-op'));
      if (!op) return;
      if (!els.input.value && op.id !== 'stats') { toast('先在左边输入一点内容吧'); return; }
      if (op.param !== undefined) { showParam(op); return; }
      hideParam();
      runOp(op.id);
    });

    els.opApply.addEventListener('click', function () {
      if (!state.pendingOp) return;
      var op = state.pendingOp;
      var param = els.opParam.value;
      hideParam();
      runOp(op.id, param);
    });
    els.opCancel.addEventListener('click', hideParam);
    els.opParam.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); els.opApply.click(); }
      if (ev.key === 'Escape') hideParam();
    });

    /* 输入 */
    var inputTimer = 0;
    els.input.addEventListener('input', function () {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(function () {
        save(KEYS.input, els.input.value);
        updateInputStat();
      }, 250);
      els.inStat.textContent = els.input.value.length + ' 字符';
    });

    /* 输出操作 */
    els.outCopyBtn.addEventListener('click', function () {
      if (!els.output.value) { toast('还没有结果可复制'); return; }
      copyText(els.output.value, '结果已复制');
    });
    els.outUseBtn.addEventListener('click', function () {
      if (!els.output.value) { toast('还没有结果可用作输入'); return; }
      els.input.value = els.output.value;
      save(KEYS.input, els.input.value);
      updateInputStat();
      toast('已把结果放回输入区');
    });
    els.outDownloadBtn.addEventListener('click', function () {
      if (!els.output.value) { toast('还没有结果可下载'); return; }
      var blob = new Blob([els.output.value], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'text-' + stamp() + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('已下载');
    });

    els.undoBtn.addEventListener('click', undo);

    /* 输入区小按钮 */
    els.inPasteBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (text) {
          if (!text) { toast('剪贴板是空的'); return; }
          els.input.value = text;
          save(KEYS.input, text);
          updateInputStat();
          toast('已粘贴 ' + text.length + ' 字符');
        }, function () {
          els.input.focus();
          toast('无法读取剪贴板，请手动粘贴（Ctrl/⌘+V）');
        });
      } else {
        els.input.focus();
        toast('请手动粘贴（Ctrl/⌘+V）');
      }
    });
    els.inClearBtn.addEventListener('click', function () {
      if (!els.input.value) { toast('输入区已经是空的'); return; }
      els.input.value = '';
      save(KEYS.input, '');
      updateInputStat();
      toast('已清空输入');
    });

    /* 顶栏 */
    els.openBtn.addEventListener('click', function () { els.fileInput.click(); });
    els.fileInput.addEventListener('change', function () {
      var f = els.fileInput.files && els.fileInput.files[0];
      if (f) loadFile(f);
      els.fileInput.value = '';
    });

    els.sampleBtn.addEventListener('click', function () {
      els.input.value = SAMPLE;
      save(KEYS.input, SAMPLE);
      updateInputStat();
      toast('已载入示例文本');
    });

    els.clearBtn.addEventListener('click', function () {
      if (!els.input.value && !els.output.value) { toast('已经是空的啦'); return; }
      if (!window.confirm('确定清空输入与结果吗？')) return;
      els.input.value = '';
      els.output.value = '';
      state.hasOutput = false;
      state.history = [];
      els.undoBtn.disabled = true;
      save(KEYS.input, '');
      updateInputStat();
      updateOutputStat();
      els.statusOp.textContent = '未执行操作';
      els.statusOp.classList.remove('is-active');
      toast('已清空');
    });

    /* 词频点击复制 */
    els.wordList.addEventListener('click', function (ev) {
      var row = ev.target.closest('.word-row');
      if (row) copyText(row.getAttribute('data-copy'));
    });

    /* 拖放 */
    document.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    document.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!f) return;
      ev.preventDefault();
      loadFile(f);
    });

    /* 快捷键 */
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        undo();
      }
      if (ev.key === 'Escape') hideParam();
    });

    /* 输入区 Tab 缩进 */
    els.input.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      ev.preventDefault();
      var s = els.input.selectionStart, e = els.input.selectionEnd;
      if (s === e) {
        els.input.setRangeText('  ', s, e, 'end');
      } else {
        var vs = els.input.value.lastIndexOf('\n', s - 1) + 1;
        var ve = els.input.value.indexOf('\n', e);
        if (ve === -1) ve = els.input.value.length;
        var block = els.input.value.slice(vs, ve);
        var out = ev.shiftKey
          ? block.split('\n').map(function (l) { return l.replace(/^ {1,2}/, ''); }).join('\n')
          : block.split('\n').map(function (l) { return '  ' + l; }).join('\n');
        els.input.setRangeText(out, vs, ve, 'end');
      }
      save(KEYS.input, els.input.value);
      updateInputStat();
    });
  }

  function loadFile(f) {
    var reader = new FileReader();
    reader.onload = function () {
      els.input.value = String(reader.result || '');
      save(KEYS.input, els.input.value);
      updateInputStat();
      toast('已载入 ' + f.name);
    };
    reader.onerror = function () { toast('文件读取失败'); };
    reader.readAsText(f, 'utf-8');
  }

  /* =======================================================================
     六、启动
     ======================================================================= */
  function init() {
    var saved = load(KEYS.input);
    els.input.value = saved === null ? SAMPLE : saved;
    save(KEYS.input, els.input.value);

    setCat(load(KEYS.cat) || 'case');
    bind();
    updateInputStat();
    updateOutputStat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
