import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceRate, weightedAverage } from "./academic-calculations";

test("weighted averages normalize grades and honor assessment weights", () => {
  const result = weightedAverage([
    { value: 8, maxGrade: 10, weight: 1 },
    { value: 6, maxGrade: 10, weight: 2 },
  ]);
  assert.equal(result, 20 / 3);
});

test("weighted average returns zero when no valid weighted assessment exists", () => {
  assert.equal(weightedAverage([]), 0);
  assert.equal(weightedAverage([{ value: 8, maxGrade: 0, weight: 1 }]), 0);
});

test("attendance reports present numerator, session denominator, and percentage", () => {
  const rate = attendanceRate([{ present: true }, { present: false }, { present: true }]);
  assert.equal(rate.present, 2);
  assert.equal(rate.sessions, 3);
  assert.ok(Math.abs(rate.percent - 200 / 3) < Number.EPSILON * 100);
  assert.deepEqual(attendanceRate([]), { present: 0, sessions: 0, percent: 0 });
});
