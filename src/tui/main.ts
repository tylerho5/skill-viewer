import { createScreen } from "./screen.js";

export async function run(): Promise<void> {
  const { screen } = createScreen();
  screen.key(["q", "C-c"], () => {
    screen.destroy();
    process.exit(0);
  });
  screen.render();
}
