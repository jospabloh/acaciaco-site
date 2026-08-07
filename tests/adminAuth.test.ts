import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordMatches, ADMIN_HEADER } from "../api/roseta/_adminAuth.ts";

test("acepta la contraseña correcta", () => {
  assert.equal(passwordMatches("s3creto-largo", "s3creto-largo"), true);
});

test("rechaza una contraseña incorrecta de la misma longitud", () => {
  assert.equal(passwordMatches("s3creto-largX", "s3creto-largo"), false);
});

test("rechaza contraseñas de distinta longitud sin lanzar", () => {
  assert.equal(passwordMatches("corta", "s3creto-largo"), false);
});

test("rechaza cuando la esperada está vacía, para no abrirse al no configurarse", () => {
  assert.equal(passwordMatches("", ""), false);
  assert.equal(passwordMatches("cualquiera", ""), false);
});

test("rechaza entradas no string", () => {
  assert.equal(passwordMatches(undefined as unknown as string, "x"), false);
});

test("el header es minúsculas, como los normaliza Node", () => {
  assert.equal(ADMIN_HEADER, ADMIN_HEADER.toLowerCase());
});
