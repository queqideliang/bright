import assert from 'node:assert/strict';
import test from 'node:test';
import { archivePage, readArchiveReport, reportsUrl } from '../src/lib/archive-report.ts';
import { loginDestination } from '../src/lib/login-destination.ts';

test('stored report keeps zero scores, scope, original values, findings, per-category counts and saved suggestions', () => {
  const source = {
    modelName:'二层样板.ifc', checkedAt:'2026-01-20T01:00:00Z', totalElements:0, complianceScore:0,
    summary:{naming:{total:3,passed:0,errors:2,warnings:1}},_note:'文件级检查，仅包含已保存的记录。',
    issues:[{id:'F-1',category:'NAMING',severity:'ERROR',elementType:'IfcDoor',elementId:'门一',field:'编号',
      currentValue:false,expectedFormat:'七段式',message:'缺少编号'}],
    fixSuggestions:{'F-1':'补充交付编号。'},
  };
  const r = readArchiveReport(source,'fallback.ifc');
  assert.equal(r.score,0); assert.equal(r.totalElements,0); assert.equal(r.modelName,source.modelName);
  assert.match(r.scope,/文件级检查/u); assert.match(r.scope,/3 项问题，留存的可读明细为 1 项/u);
  assert.deepEqual(r.summaries,[{label:'文件命名',total:3,errors:2,warnings:1,passed:0}]);
  assert.equal(r.rules[0].checked,undefined);
  assert.deepEqual(r.issues,[{category:'文件命名',severity:'错误',elementId:'门一',elementName:'IfcDoor',field:'编号',
    actual:'false',expected:'七段式',message:'缺少编号',suggestion:'补充交付编号。'}]);
});

test('partial historical data preserves unknowns and empty values without estimating the model score or summary', () => {
  assert.equal(readArchiveReport({},'empty'),null);
  const partial = readArchiveReport({summary:{custom:{errors:0}}},'历史模型');
  assert.equal(partial.checkedAt,'未记录'); assert.equal(partial.totalElements,undefined); assert.equal(partial.score,undefined);
  assert.equal(partial.summaries[0].passed,undefined); assert.match(partial.scope,/未保存问题明细/u);
  const r=readArchiveReport({issues:[{currentValue:''},{currentValue:null},{currentValue:0},{},'bad row']},'历史模型');
  assert.deepEqual(r.issues.map(i=>i.actual),['（空字符串）','（空值）','0',undefined]); assert.match(r.scope,/部分历史明细/u);
});

test('reports login links keep the requested page and model, while arbitrary destinations are rejected', () => {
  const model='115d1042-5230-4958-8ec5-af8c9c66f628';
  for (const page of [1,2]) {
    for (const id of [undefined,model]) {
      const href=reportsUrl(page,id);
      assert.equal(loginDestination(href),href);
    }
  }
  for (const unsafe of ['/reports?model=https://bad.invalid','/reports?model='+model+'&next=/admin','/reports?page=0','//other/reports'])
    assert.equal(loginDestination(unsafe),'/models');
  assert.equal(archivePage('2'),2); assert.equal(archivePage('1000000'),1); assert.equal(archivePage([]),1);
});
