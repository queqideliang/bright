import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utils, write, type BookType } from 'xlsx';
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import { readSpreadsheet } from '../src/lib/project-spreadsheet.ts';

function workbook(type: BookType) {
  const book = utils.book_new();
  const rows = utils.aoa_to_sheet([['材料工程量清单'], ['编号','楼层','工程量','单位','复核完成'], ['00012','三层',0,'m³',false], ['00013','二层',2.45,'m³',true]]);
  rows.C4.z = '0.000';
  utils.book_append_sheet(book, rows, '土建');
  utils.book_append_sheet(book, utils.aoa_to_sheet([['内部资料']]), '隐藏');
  utils.book_append_sheet(book, utils.aoa_to_sheet([['编号','名称'],['007','水泵']]), '机电');
  book.Workbook = { Sheets: [{name:'土建', Hidden:0},{name:'隐藏',Hidden:2},{name:'机电',Hidden:0}] };
  return new Uint8Array(write(book, { type: 'buffer', bookType: type }));
}
for (const [type, suffix] of [['xlsx','xlsx'],['biff8','xls']] as const) {
  test('real ' + type + ' preserves visible sheets, formatted quantities, units and identifiers', async () => {
    const passages = await readSpreadsheet(new File([workbook(type)], 'demo.' + suffix));
    const third = passages.find(p => p.location === '工作表「土建」!A3:E3');
    assert.ok(third);
    assert.match(third.text,/编号=00012/); assert.match(third.text,/楼层=三层/);
    assert.match(third.text,/工程量=0/); assert.match(third.text,/单位=m³/); assert.match(third.text,/复核完成=FALSE/i);
    assert.ok(passages.some(p => p.location.includes('土建') && p.text.includes('2.450')));
    assert.ok(passages.some(p => p.location.includes('机电') && p.text.includes('007')));
    assert.ok(passages.every(p => !/内部资料|隐藏/.test(p.location + p.text)));
  });
}
test('XLSX uses cached formula values and never turns an uncached formula into zero', async () => {
  const files = unzipSync(workbook('xlsx'));
  const filename = 'xl/worksheets/sheet1.xml';
  files[filename] = strToU8(strFromU8(files[filename]).replace(/<c r="C3"[^>]*>[\s\S]*?<\/c>/, '<c r="C3"><f>1+1</f></c>')
    .replace(/<c r="C4"[^>]*>[\s\S]*?<\/c>/,'<c r="C4"><f>1+1</f><v>2</v></c>'));
  const rows = await readSpreadsheet(new File([new Uint8Array(zipSync(files))], 'formulas.xlsx'));
  assert.ok(rows.some(p => p.location.includes('A3:E3') && p.text.includes('未保存可读取的公式缓存')));
  assert.ok(rows.some(p => p.location.includes('A4:E4') && p.text.includes('公式缓存值 2')));
});
test('sparse last cell and long rows retain accurate split addresses and row context', async () => {
  const book = utils.book_new(), sheet = utils.aoa_to_sheet([['编号','说明','单位','备注'],['001','文'.repeat(900),'kg','尾'.repeat(900)]]);
  utils.sheet_add_aoa(sheet, [['稀疏尾值']], {origin:'XFD1048576'});
  utils.book_append_sheet(book, sheet, 'Sparse');
  // Avoid a rectangular writer traversal on the intentionally sparse fixture.
  delete sheet.XFD1048576; sheet['!ref'] = 'A1:D2';
  const files = unzipSync(new Uint8Array(write(book,{type:'buffer',bookType:'xlsx'})));
  const file = 'xl/worksheets/sheet1.xml';
  files[file] = strToU8(strFromU8(files[file]).replace('</sheetData>', '<row r="1048576"><c r="XFD1048576" t="str"><v>稀疏尾值</v></c></row></sheetData>'));
  const rows = await readSpreadsheet(new File([new Uint8Array(zipSync(files))], 'sparse.xlsx'));
  assert.ok(rows.some(p => p.location.endsWith('!D2') && p.text.includes('编号=001') && p.text.includes('单位=kg')));
  assert.ok(rows.some(p => p.location.endsWith('!XFD1048576') && p.text.includes('稀疏尾值')));
});
test('CSV and TSV preserve leading zeroes, quoted separators and literal formulas', async () => {
  for (const [ext, sep] of [['csv',','],['tsv','\t']]) {
    const input = ['编号'+sep+'说明', '0002'+sep+'"A'+sep+'B"', '0003'+sep+'=1+1'].join('\r\n');
    const rows = await readSpreadsheet(new File([input], '表.' + ext));
    assert.ok(rows.some(p => p.text.includes('编号=0002') && p.text.includes('A'+sep+'B')));
    assert.ok(rows.some(p => p.text.includes('=1+1')));
  }
});
test('incompatible content and overlong cell fail explicitly', async () => {
  await assert.rejects(readSpreadsheet(new File(['a,b'], 'fake.xls')), /格式不符/);
  await assert.rejects(readSpreadsheet(new File(['X'.repeat(2400)], 'large.csv')), /单元格内容过长/);
});
