#!/usr/bin/env node
/**
 * 构建钩子：修复 cordova-plugin-barcodescanner 的 iOS 源码在 Xcode 26 下的编译错误。
 * 问题：CDVBarcodeScanner.mm 第 681/890 行把 UIInterfaceOrientation 直接赋给
 *       AVCaptureVideoOrientation，旧 Xcode 仅警告，Xcode 26 报 error。
 * 修复：加显式类型转换 (AVCaptureVideoOrientation)。
 * 幂等：已补丁过的文件再次执行不会重复修改。
 */
const fs = require('fs');
const path = require('path');

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findFile(p, name);
      if (r) return r;
    } else if (e.name === name) {
      return p;
    }
  }
  return null;
}

const mm = findFile(path.resolve(__dirname, '..', 'platforms', 'ios'), 'CDVBarcodeScanner.mm');
if (!mm) {
  console.log('[fix-barcodescanner] CDVBarcodeScanner.mm 未找到，跳过（可能未添加 iOS 平台）');
  process.exit(0);
}

let src = fs.readFileSync(mm, 'utf8');
let changed = 0;

const fixes = [
  [
    'self.processor.previewLayer.connection.videoOrientation = [[UIApplication sharedApplication] statusBarOrientation];',
    'self.processor.previewLayer.connection.videoOrientation = (AVCaptureVideoOrientation)[[UIApplication sharedApplication] statusBarOrientation];'
  ],
  [
    'self.processor.previewLayer.connection.videoOrientation = orientation;',
    'self.processor.previewLayer.connection.videoOrientation = (AVCaptureVideoOrientation)orientation;'
  ]
];

for (const [from, to] of fixes) {
  if (src.includes(from)) {
    src = src.split(from).join(to);
    changed++;
  }
}

fs.writeFileSync(mm, src);
console.log('[fix-barcodescanner] 已补丁 ' + mm + '（完成 ' + changed + ' 处替换）');
