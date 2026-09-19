import test from "node:test";
import assert from "node:assert/strict";
import { parseNavigationCommand, parseNumberString, parseReaderCommand } from "../src/command/index.ts";
import { SURAH_DATA, getSurahInfo, validateSurahAndAyah } from "../src/quran/index.ts";

test("Number Parser - Digits and Indonesian words", () => {
  assert.equal(parseNumberString("255"), 255);
  assert.equal(parseNumberString("58"), 58);
  assert.equal(parseNumberString("10"), 10);
  assert.equal(parseNumberString("1"), 1);
  assert.equal(parseNumberString("ke-255"), 255);
  assert.equal(parseNumberString("ke 10"), 10);

  assert.equal(parseNumberString("satu"), 1);
  assert.equal(parseNumberString("tujuh"), 7);
  assert.equal(parseNumberString("sepuluh"), 10);
  assert.equal(parseNumberString("sebelas"), 11);
  assert.equal(parseNumberString("dua belas"), 12);
  assert.equal(parseNumberString("sembilan belas"), 19);
  assert.equal(parseNumberString("dua puluh"), 20);
  assert.equal(parseNumberString("lima puluh delapan"), 58);
  assert.equal(parseNumberString("seratus"), 100);
  assert.equal(parseNumberString("seratus sepuluh"), 110);
  assert.equal(parseNumberString("dua ratus lima puluh lima"), 255);
  assert.equal(parseNumberString("dua ratus delapan puluh enam"), 286);
});

test("Command Parser - Acceptance Criteria Examples", () => {
  // 1. "Al-Baqarah ayat 255" -> { surah: 2, ayah: 255 }
  const res1 = parseNavigationCommand("Al-Baqarah ayat 255");
  assert.equal(res1.success, true);
  if (res1.success) {
    assert.equal(res1.surah, 2);
    assert.equal(res1.ayah, 255);
    assert.equal(res1.surahName, "Al-Baqarah");
  }

  // 2. "Surat Yasin ayat 58" -> { surah: 36, ayah: 58 }
  const res2 = parseNavigationCommand("Surat Yasin ayat 58");
  assert.equal(res2.success, true);
  if (res2.success) {
    assert.equal(res2.surah, 36);
    assert.equal(res2.ayah, 58);
    assert.equal(res2.surahName, "Ya Sin");
  }

  // 3. "Al-Kahfi ayat 10" -> { surah: 18, ayah: 10 }
  const res3 = parseNavigationCommand("Al-Kahfi ayat 10");
  assert.equal(res3.success, true);
  if (res3.success) {
    assert.equal(res3.surah, 18);
    assert.equal(res3.ayah, 10);
    assert.equal(res3.surahName, "Al-Kahf");
  }

  // 4. "Surat 2 ayat 255" -> { surah: 2, ayah: 255 }
  const res4 = parseNavigationCommand("Surat 2 ayat 255");
  assert.equal(res4.success, true);
  if (res4.success) {
    assert.equal(res4.surah, 2);
    assert.equal(res4.ayah, 255);
  }
});

test("Command Parser - Spoken Word Numbers & Variations", () => {
  const res1 = parseNavigationCommand("Surat Yasin ayat lima puluh delapan");
  assert.equal(res1.success, true);
  if (res1.success) {
    assert.equal(res1.surah, 36);
    assert.equal(res1.ayah, 58);
  }

  const res2 = parseNavigationCommand("Surat tiga puluh enam ayat lima puluh delapan");
  assert.equal(res2.success, true);
  if (res2.success) {
    assert.equal(res2.surah, 36);
    assert.equal(res2.ayah, 58);
  }

  const res3 = parseNavigationCommand("Buka surat Al-Baqarah ayat dua ratus lima puluh lima");
  assert.equal(res3.success, true);
  if (res3.success) {
    assert.equal(res3.surah, 2);
    assert.equal(res3.ayah, 255);
  }

  const res4 = parseNavigationCommand("Tolong buka surat Al-Kahfi ayat ke-10");
  assert.equal(res4.success, true);
  if (res4.success) {
    assert.equal(res4.surah, 18);
    assert.equal(res4.ayah, 10);
  }

  const res5 = parseNavigationCommand("Ayat 255 surat Al-Baqarah");
  assert.equal(res5.success, true);
  if (res5.success) {
    assert.equal(res5.surah, 2);
    assert.equal(res5.ayah, 255);
  }

  const res6 = parseNavigationCommand("Al Baqarah 255");
  assert.equal(res6.success, true);
  if (res6.success) {
    assert.equal(res6.surah, 2);
    assert.equal(res6.ayah, 255);
  }
});

test("Command Parser - Invalid Ayah Rejections", () => {
  // Al-Baqarah max ayah is 286. 300 should be rejected
  const res1 = parseNavigationCommand("Al-Baqarah ayat 300");
  assert.equal(res1.success, false);
  if (!res1.success) {
    assert.equal(res1.reason, "invalid_ayah");
    assert.equal(res1.surah, 2);
    assert.equal(res1.ayah, 300);
    assert.equal(res1.maxAyah, 286);
  }

  // Al-Fatihah max ayah is 7. 8 should be rejected
  const res2 = parseNavigationCommand("Al-Fatihah ayat 8");
  assert.equal(res2.success, false);
  if (!res2.success) {
    assert.equal(res2.reason, "invalid_ayah");
    assert.equal(res2.surah, 1);
    assert.equal(res2.ayah, 8);
    assert.equal(res2.maxAyah, 7);
  }

  // An-Nas max ayah is 6. 10 should be rejected
  const res3 = parseNavigationCommand("An-Nas ayat 10");
  assert.equal(res3.success, false);
  if (!res3.success) {
    assert.equal(res3.reason, "invalid_ayah");
    assert.equal(res3.surah, 114);
    assert.equal(res3.ayah, 10);
    assert.equal(res3.maxAyah, 6);
  }

  // Ayah 0 should be rejected
  const res4 = parseNavigationCommand("Surat Al-Baqarah ayat 0");
  assert.equal(res4.success, false);
  if (!res4.success) {
    assert.equal(res4.reason, "invalid_ayah");
  }
});

test("Command Parser - Invalid Surah Rejections", () => {
  // Surah 115 is invalid (only 1..114)
  const res1 = parseNavigationCommand("Surat 115 ayat 1");
  assert.equal(res1.success, false);
  if (!res1.success) {
    assert.equal(res1.reason, "invalid_surah");
  }

  // Non-existent surah name
  const res2 = parseNavigationCommand("Surat Gandum ayat 10");
  assert.equal(res2.success, false);
  if (!res2.success) {
    assert.equal(res2.reason, "invalid_surah");
  }
});

test("Reader command parser supports deterministic hands-free controls", () => {
  const commands = new Map([
    ["baca ulang ayat", "repeat"],
    ["ayat berikutnya", "next"],
    ["ayat sebelumnya", "previous"],
    ["kembali ke posisi bacaan aktif", "current"],
    ["stop listening", "stop"],
    ["resume listening", "resume"],
    ["mulai membaca", "start"]
  ] as const);

  for (const [input, command] of commands) {
    const result = parseReaderCommand(input);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.command, command);
  }

  const invalid = parseReaderCommand("lompat ke ayat ajaib");
  assert.equal(invalid.success, false);
});

test("Quran Metadata - 114 Surahs Coverage", () => {
  assert.equal(SURAH_DATA.length, 114);

  // Validate every surah from 1 to 114
  for (let surahNum = 1; surahNum <= 114; surahNum++) {
    const info = getSurahInfo(surahNum);
    assert.ok(info, `Surah ${surahNum} must exist`);
    assert.equal(info.number, surahNum);
    assert.ok(info.totalAyahs > 0, `Surah ${surahNum} must have > 0 ayahs`);

    // Valid bounds check
    const validFirst = validateSurahAndAyah(surahNum, 1);
    assert.equal(validFirst.valid, true);

    const validLast = validateSurahAndAyah(surahNum, info.totalAyahs);
    assert.equal(validLast.valid, true);

    const invalidNext = validateSurahAndAyah(surahNum, info.totalAyahs + 1);
    assert.equal(invalidNext.valid, false);
  }
});

test("Command Parser - Every canonical Surah name is recognized", () => {
  for (const surah of SURAH_DATA) {
    const result = parseNavigationCommand(`${surah.name} ayat 1`);
    assert.equal(result.success, true, `${surah.name} should be recognized`);
    if (result.success) {
      assert.equal(result.surah, surah.number);
      assert.equal(result.ayah, 1);
    }
  }
});
