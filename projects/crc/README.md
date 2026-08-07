# CRC 校验计算

循环冗余校验（CRC）计算工具，支持常用的 CRC-16 变体与 CRC-32。纯浏览器零依赖，可校验文本或 HEX 字节流。

## 功能

- CRC-16/CCITT-FALSE、CRC-16/XMODEM、CRC-16/IBM-ARC、CRC-16/MODBUS。
- CRC-32（以太网 / ZIP / PNG 等通用）。
- 输入支持文本（UTF-8）或 HEX，结果以十六进制输出。

## 技术说明

- 16 位算法区分反射（IBM-ARC / MODBUS，LSB 优先）与非反射（CCITT / XMODEM，MSB 优先）两种实现。
- CRC-32 采用标准反射多项式 `0xEDB88320`，初始值 `0xFFFFFFFF`，结果异或 `0xFFFFFFFF`。
- 已用经典校验串 `123456789` 验证：CCITT-FALSE=0x29B1、XMODEM=0x31C3、IBM-ARC=0xBB3D、MODBUS=0x4B37、CRC-32=0xCBF43926。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/crc/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/crc.test.js
```
