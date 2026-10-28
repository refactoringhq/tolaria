// Tolaria VitePress theme: the tolaria-landing look (Refactoring brand tokens, Inter / Inter Tight / Refactoring Sans,
// primary blue with white text, frosted nav with the drop + wordmark, filled Phosphor icons, the ASCII field).
// Extends vitepress/theme-without-fonts: the brand Inter comes from ./fonts, so VitePress's bundled Inter is not loaded twice.
// Source of truth: refactoringhq/tolaria-landing packages/vitepress-theme. Copy, don't edit in place (see README).
import DefaultTheme from "vitepress/theme-without-fonts"
import type { Theme } from "vitepress"
import Layout from "./Layout.vue"
import AsciiField from "./components/AsciiField.vue"
import DocsHome from "./components/DocsHome.vue"
import DocsBand from "./components/DocsBand.vue"
import PhIcon from "./components/PhIcon.vue"
import "./styles/fonts.css"
import "./styles/tokens.css"
import "./styles/theme.css"
import "./styles/home.css"

export { AsciiField, DocsHome, DocsBand, PhIcon }

const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("TolariaDocsHome", DocsHome)
    app.component("TolariaAsciiField", AsciiField)
    app.component("TolariaBand", DocsBand)
    app.component("PhIcon", PhIcon)
  },
}
export default theme
