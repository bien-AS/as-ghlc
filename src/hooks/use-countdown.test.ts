import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { useCountdown } from "@/hooks/use-countdown";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// A clock that moves on by a millisecond every time it is read, as a real one
// can between two consecutive reads.
function clockThatAlwaysMoves() {
  let at = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => at++);
}

test("starts at exactly the seconds asked for, even if the clock moves between reads", () => {
  clockThatAlwaysMoves();
  const { result } = renderHook(() => useCountdown(60));
  expect(result.current[0]).toBe(60);
});

test("start() shows exactly the seconds asked for, never one more", () => {
  clockThatAlwaysMoves();
  const { result } = renderHook(() => useCountdown());
  expect(result.current[0]).toBe(0);

  act(() => result.current[1](60));
  expect(result.current[0]).toBe(60);
});

test("counts down by the clock and stops at zero", () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  const { result } = renderHook(() => useCountdown(60));

  act(() => {
    vi.advanceTimersByTime(30_000);
  });
  expect(result.current[0]).toBe(30);

  act(() => {
    vi.advanceTimersByTime(45_000);
  });
  expect(result.current[0]).toBe(0);
});
