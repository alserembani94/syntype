import type { CompletionItem, Language, SuggestionKind, VocabularyPack } from '../types'
import { parseSnippets } from '../snippets'
import { python } from '../python'
import raw from './snippets.txt?raw'

const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** Selenium's Python API, always on in this track. */
export const seleniumPack: VocabularyPack = {
  name: 'selenium',
  globals: [
    ...items('webdriver By Keys WebDriverWait Select ActionChains EC', 'class'),
    ...items('expected_conditions', 'module'),
  ],
  members: {
    webdriver: items('Chrome Firefox Edge Safari ChromeOptions FirefoxOptions Remote', 'class'),
    By: items('ID NAME CSS_SELECTOR XPATH CLASS_NAME TAG_NAME LINK_TEXT PARTIAL_LINK_TEXT', 'variable'),
    Keys: items('ENTER RETURN TAB ESCAPE BACKSPACE ARROW_DOWN ARROW_UP', 'variable'),
    EC: items(
      'presence_of_element_located visibility_of_element_located element_to_be_clickable title_contains title_is url_contains text_to_be_present_in_element invisibility_of_element_located alert_is_present',
      'function',
    ),
    // Driver, element, wait and Select methods, offered after any other ".".
    '*': items(
      'get find_element find_elements click send_keys clear text get_attribute is_displayed is_enabled is_selected submit quit close title current_url page_source execute_script save_screenshot implicitly_wait maximize_window add_argument until until_not select_by_visible_text select_by_value first_selected_option switch_to',
      'method',
    ),
  },
}

/** Selenium tests in Python: everything from the Python language, plus Selenium's vocabulary. */
export const selenium: Language = {
  ...python,
  id: 'selenium',
  name: 'Selenium',
  category: 'Testing & QA',
  aliases: ['webdriver'],
  basedOn: 'Python',
  completion: { ...python.completion, packs: [...(python.completion?.packs ?? []), seleniumPack] },
  snippets: parseSnippets(raw),
}
