/*
  Next вызывает instrumentation во всех рантаймах. Весь код фоновых задач
  использует Node API, поэтому держим здесь только runtime-переключатель:
  сборщик Edge не должен даже прослеживать импорты очереди, бэкапов и sharp.
*/
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;
    const { registerNodeInstrumentation } = await import("./instrumentation.node");
    await registerNodeInstrumentation();
  }
}
