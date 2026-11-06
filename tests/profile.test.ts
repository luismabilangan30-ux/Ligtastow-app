import assert from "node:assert/strict"
import { test } from "node:test"
import {
  cleanProfile,
  normalizePhone,
  profileInitials,
  validateProfile,
} from "../src/motorist/profileModel.ts"

test("profile accepts optional contacts and Unicode names without requiring multiple names", () => {
  assert.deepEqual(validateProfile({ name: "José", email: "", phone: "" }), {})
  assert.deepEqual(
    validateProfile({ name: "李 明", email: "sample@example.com", phone: "" }),
    {},
  )
})

test("profile rejects blank names, malformed emails and invalid mobile numbers", () => {
  const errors = validateProfile({
    name: " ",
    email: "not-an-email",
    phone: "+63 123",
  })
  assert.deepEqual(Object.keys(errors), ["name", "email", "phone"])
  assert.ok(
    validateProfile({ name: "A".repeat(81), email: "", phone: "" }).name,
  )
  for (const phone of [
    "+6391712345678",
    "0917123456",
    "abc09171234567",
    "+14155551234",
  ]) {
    assert.ok(
      validateProfile({ name: "Demo Motorist", email: "", phone }).phone,
    )
  }
})

test("Philippine mobile formats normalize consistently without dropping invalid letters", () => {
  for (const phone of [
    "0917 123 4567",
    "9171234567",
    "639171234567",
    "+63 (917) 123-4567",
  ]) {
    assert.equal(normalizePhone(phone), "+639171234567")
    assert.equal(
      validateProfile({ name: "Demo", email: "", phone }).phone,
      undefined,
    )
  }
  assert.equal(normalizePhone("ABC09171234567"), "ABC09171234567")
})

test("saving a profile trims fields without mutating the original and generates initials", () => {
  const draft = {
    name: "  Demo   Motorist  ",
    email: " demo@example.com ",
    phone: " 0917 123 4567 ",
  }
  assert.deepEqual(cleanProfile(draft), {
    name: "Demo Motorist",
    email: "demo@example.com",
    phone: "+639171234567",
  })
  assert.equal(draft.name, "  Demo   Motorist  ")
  assert.equal(profileInitials("Demo Motorist"), "DM")
  assert.equal(profileInitials("José"), "J")
  assert.equal(profileInitials(""), "M")
})
