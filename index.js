require("dotenv").config();
const { WakaTimeClient, RANGE } = require("wakatime-client");
const { Octokit } = require("@octokit/rest");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey,
  WAKATIME_API_URL: wakatimeApiUrl
} = process.env;

const GIST_TITLE = "Hours this week";
const MAX_LANGUAGES = 5;
const BAR_WIDTH = 21;

const wakatime = new WakaTimeClient(wakatimeApiKey, wakatimeApiUrl);
const octokit = new Octokit({ auth: githubToken });

async function main() {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  await updateGist(stats);
}

function trimRightStr(str, len) {
  // Ellipsis takes 3 positions, so the index of substring is 0 to total length - 3.
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

async function updateGist(stats) {
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
    return;
  }

  const languages = stats.data.languages || [];
  const lines = [];

  for (let i = 0; i < Math.min(languages.length, MAX_LANGUAGES); i++) {
    const data = languages[i];
    const { name, percent, text: time } = data;
    const line = [
      trimRightStr(name, 10).padEnd(10),
      time.padEnd(14),
      generateBarChart(percent, BAR_WIDTH),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];
    lines.push(line.join(" "));
  }

  if (lines.length === 0) {
    console.log("No language data returned for this range, skipping update.");
    return;
  }

  // Add a total-time header above the breakdown
  const totalTime = stats.data.human_readable_total || stats.data.text;
  const header = totalTime ? [`Total: ${totalTime}`, ""] : [];
  const content = [...header, ...lines].join("\n");

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: GIST_TITLE,
          content
        }
      }
    });
    console.log("Gist updated successfully.");
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";
  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;
  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(`Fatal error running hacka-box\n${error}`);
    process.exitCode = 1;
  }
})();
