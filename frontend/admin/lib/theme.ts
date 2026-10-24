export const THEME_KEY = "theme";

/**
 * Runs in <head> before first paint so a saved choice never flashes the other
 * theme. Without a saved choice the page follows the OS (globals.css).
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
