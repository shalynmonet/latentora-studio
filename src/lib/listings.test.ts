import { describe, expect, it } from "vitest";
import { formatPay, interleave, kindFromLabels } from "./listings";
import type { JobListing } from "./types";

const l = (provider: JobListing["provider"], title: string, company = "Co"): JobListing => ({
  provider, external_id: `${provider}:${title}`, title, company, url: "", location: "Remote", category: "", description: "", published_at: "", kind: "job", pay: null,
});

describe("unified listings", () => {
  it("mixes sources round-robin into one list", () => {
    const out = interleave([[l("remotive", "A"), l("remotive", "B")], [l("opentrain", "C")], [l("jobicy", "D")]]);
    expect(out.map((x) => x.title)).toEqual(["A", "C", "D", "B"]);
  });

  it("drops the same title+company appearing in two feeds", () => {
    const out = interleave([[l("remotive", "Writer", "Acme")], [l("jobicy", "writer ", "ACME")]]);
    expect(out).toHaveLength(1);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => l("remotive", `R${i}`));
    expect(interleave([many, many.map((x) => ({ ...x, title: `J${x.title}` }))], 40)).toHaveLength(40);
  });

  it("labels contract work from the source's own job type", () => {
    expect(kindFromLabels(["Contract"])).toBe("contract");
    expect(kindFromLabels(["freelance"])).toBe("contract");
    expect(kindFromLabels(["Full-Time"])).toBe("job");
    expect(kindFromLabels([])).toBe("job");
  });

  it("shows pay only when the source gives it", () => {
    expect(formatPay(null, null, "USD", "/ hour")).toBeNull();
    expect(formatPay(15, 15, "USD", "/ hour")).toBe("$15 / hour");
    expect(formatPay(600, 1500, "INR", "fixed price")).toBe("600–1,500 INR fixed price");
  });
});
