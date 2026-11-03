#!/usr/bin/env python3
"""Save this repository's GitHub traffic, forks and stars before GitHub forgets them.

GitHub only keeps views and clones for the last 14 days. This script is run
daily by .github/workflows/traffic-stats.yml and merges each day's numbers into
CSV files on the `traffic-stats` branch, so a long-running record builds up.

Files written to the output folder:
  views.csv      date, views, unique_visitors        (one row per day)
  clones.csv     date, clones, unique_cloners        (one row per day)
  referrers.csv  snapshot_date, referrer, views, unique_visitors   (14-day totals, one snapshot per run)
  paths.csv      snapshot_date, path, title, views, unique_visitors (14-day totals, one snapshot per run)
  forks.csv      owner, fork_url, forked_at, first_seen, still_exists
  stars.csv      user, starred_at, first_seen, still_starred
  SUMMARY.md     running totals, rewritten every run

Environment:
  TRAFFIC_TOKEN  token allowed to read the repository's traffic. A fine-grained
                 personal access token for this repository with
                 "Administration: Read-only" works. Without it, forks and stars
                 are still saved and the script exits with an error so the
                 missing token gets noticed.
  GITHUB_TOKEN   optional; used for the public fork and star lists.

Usage: python3 scripts/traffic_stats.py --repo owner/name --out folder
Only the Python standard library is used.
"""

import argparse
import csv
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"


def today():
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def get(path, token, accept="application/vnd.github+json"):
    """GET one API path and return the decoded JSON."""
    request = urllib.request.Request(API + path)
    request.add_header("Accept", accept)
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    request.add_header("User-Agent", "traffic-stats-script")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def get_with_any(path, tokens, accept="application/vnd.github+json"):
    """Try each token in turn (None means no token) and return the first answer.

    The fork and star lists are public, but some tokens are refused for them
    ("Resource not accessible by integration"), so a refusal moves on to the next.
    """
    last_error = None
    for token in tokens:
        try:
            return get(path, token, accept)
        except urllib.error.HTTPError as error:
            if error.code not in (401, 403):
                raise
            last_error = error
    raise last_error


def get_all(path, tokens, accept="application/vnd.github+json"):
    """GET every page of a list endpoint."""
    items, page = [], 1
    separator = "&" if "?" in path else "?"
    while True:
        batch = get_with_any(f"{path}{separator}per_page=100&page={page}", tokens, accept)
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, fields, rows):
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def merge_daily(path, fields, new_rows):
    """Upsert one row per date. GitHub may revise the most recent days, so newer data wins."""
    by_date = {row["date"]: row for row in read_csv(path)}
    for row in new_rows:
        by_date[row["date"]] = row
    write_csv(path, fields, [by_date[d] for d in sorted(by_date)])
    return [by_date[d] for d in sorted(by_date)]


def replace_snapshot(path, fields, snapshot_rows, snapshot_date):
    """Keep earlier snapshots and replace today's, so re-running on one day is harmless."""
    kept = [row for row in read_csv(path) if row["snapshot_date"] != snapshot_date]
    write_csv(path, fields, kept + snapshot_rows)


def merge_people(path, fields, key, current, flag, run_date):
    """Union of everyone ever seen; people who left stay listed with flag 'no'."""
    known = {row[key]: row for row in read_csv(path)}
    for row in known.values():
        row[flag] = "no"
    for row in current:
        previous = known.get(row[key])
        row["first_seen"] = previous["first_seen"] if previous else run_date
        row[flag] = "yes"
        known[row[key]] = row
    rows = sorted(known.values(), key=lambda r: (r["first_seen"], r[key].lower()))
    write_csv(path, fields, rows)
    return rows


def save_forks_and_stars(repo, tokens, out, run_date):
    forks = get_all(f"/repos/{repo}/forks?sort=oldest", tokens)
    fork_rows = [
        {
            "owner": f["owner"]["login"],
            "fork_url": f["html_url"],
            "forked_at": f["created_at"],
        }
        for f in forks
    ]
    fork_rows = merge_people(
        os.path.join(out, "forks.csv"),
        ["owner", "fork_url", "forked_at", "first_seen", "still_exists"],
        "fork_url",
        fork_rows,
        "still_exists",
        run_date,
    )

    stars = get_all(f"/repos/{repo}/stargazers", tokens, "application/vnd.github.star+json")
    star_rows = [{"user": s["user"]["login"], "starred_at": s["starred_at"]} for s in stars]
    star_rows = merge_people(
        os.path.join(out, "stars.csv"),
        ["user", "starred_at", "first_seen", "still_starred"],
        "user",
        star_rows,
        "still_starred",
        run_date,
    )
    return fork_rows, star_rows


def save_traffic(repo, token, out, run_date):
    views = get(f"/repos/{repo}/traffic/views?per=day", token)
    view_rows = merge_daily(
        os.path.join(out, "views.csv"),
        ["date", "views", "unique_visitors"],
        [
            {"date": v["timestamp"][:10], "views": v["count"], "unique_visitors": v["uniques"]}
            for v in views["views"]
        ],
    )

    clones = get(f"/repos/{repo}/traffic/clones?per=day", token)
    clone_rows = merge_daily(
        os.path.join(out, "clones.csv"),
        ["date", "clones", "unique_cloners"],
        [
            {"date": c["timestamp"][:10], "clones": c["count"], "unique_cloners": c["uniques"]}
            for c in clones["clones"]
        ],
    )

    referrers = get(f"/repos/{repo}/traffic/popular/referrers", token)
    replace_snapshot(
        os.path.join(out, "referrers.csv"),
        ["snapshot_date", "referrer", "views", "unique_visitors"],
        [
            {
                "snapshot_date": run_date,
                "referrer": r["referrer"],
                "views": r["count"],
                "unique_visitors": r["uniques"],
            }
            for r in referrers
        ],
        run_date,
    )

    paths = get(f"/repos/{repo}/traffic/popular/paths", token)
    replace_snapshot(
        os.path.join(out, "paths.csv"),
        ["snapshot_date", "path", "title", "views", "unique_visitors"],
        [
            {
                "snapshot_date": run_date,
                "path": p["path"],
                "title": p["title"],
                "views": p["count"],
                "unique_visitors": p["uniques"],
            }
            for p in paths
        ],
        run_date,
    )
    return view_rows, clone_rows


def total(rows, field):
    return sum(int(row[field]) for row in rows)


def write_summary(repo, out, run_date, view_rows, clone_rows, fork_rows, star_rows):
    lines = [
        f"# Traffic record for {repo}",
        "",
        f"Last updated {run_date} (UTC). Written by `scripts/traffic_stats.py`.",
        "",
    ]
    if view_rows or clone_rows:
        first = min(r["date"] for r in view_rows + clone_rows)
        lines += [
            f"Recorded since {first}:",
            "",
            "| Measure | Total |",
            "| --- | --- |",
            f"| Views | {total(view_rows, 'views')} |",
            f"| Clones | {total(clone_rows, 'clones')} |",
            "",
            "Daily unique visitors and unique cloners are in `views.csv` and `clones.csv`. "
            "They can't be added across days, because the same person may come back.",
            "",
        ]
    else:
        lines += ["No traffic recorded yet. Check that the TRAFFIC_TOKEN secret is set.", ""]
    current_forks = [r for r in fork_rows if r["still_exists"] == "yes"]
    current_stars = [r for r in star_rows if r["still_starred"] == "yes"]
    lines += [
        f"Forks: {len(current_forks)} now, {len(fork_rows)} ever recorded (`forks.csv`).",
        "",
        f"Stars: {len(current_stars)} now, {len(star_rows)} ever recorded (`stars.csv`).",
        "",
        "Where visitors came from, and which pages they read, are in `referrers.csv` and "
        "`paths.csv` as 14-day totals, one snapshot per day.",
        "",
    ]
    with open(os.path.join(out, "SUMMARY.md"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--repo", required=True, help="owner/name")
    parser.add_argument("--out", required=True, help="folder for the CSV files")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    run_date = today()
    traffic_token = os.environ.get("TRAFFIC_TOKEN", "").strip()
    github_token = os.environ.get("GITHUB_TOKEN", "").strip()
    public_tokens = [t for t in (github_token, traffic_token) if t] + [None]

    problems = []
    try:
        fork_rows, star_rows = save_forks_and_stars(args.repo, public_tokens, args.out, run_date)
        print(f"Forks recorded: {len(fork_rows)}. Stars recorded: {len(star_rows)}.")
    except urllib.error.HTTPError as error:
        problems.append(f"GitHub refused the fork or star list ({error.code}).")
        fork_rows = read_csv(os.path.join(args.out, "forks.csv"))
        star_rows = read_csv(os.path.join(args.out, "stars.csv"))

    view_rows = read_csv(os.path.join(args.out, "views.csv"))
    clone_rows = read_csv(os.path.join(args.out, "clones.csv"))
    if not traffic_token:
        problems.append("The TRAFFIC_TOKEN secret is not set, so views and clones were not saved.")
    else:
        try:
            view_rows, clone_rows = save_traffic(args.repo, traffic_token, args.out, run_date)
            print(f"Days of views recorded: {len(view_rows)}. Days of clones recorded: {len(clone_rows)}.")
        except urllib.error.HTTPError as error:
            problems.append(
                f"GitHub refused the traffic request ({error.code}). The TRAFFIC_TOKEN needs "
                "access to this repository with 'Administration: Read-only' permission, "
                "and it may have expired."
            )

    write_summary(args.repo, args.out, run_date, view_rows, clone_rows, fork_rows, star_rows)
    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
