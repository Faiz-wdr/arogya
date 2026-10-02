/**
 * Malayalam Unicode to MVM (ML-TT / ASCII legacy font layout) Converter
 * Used for automated poster typography in Arogya Hospital Designer & Staff portals.
 *
 * MVM fonts (MVMAthira, MLKVShaji) map standard Malayalam Unicode characters
 * and syllables to specific ASCII glyph positions according to the ML-TT specification.
 */

// Common hospital phrases, departments, and qualification overrides for 100% deterministic precision
const KNOWN_PHRASES: Record<string, string> = {
  // Doctor prefixes
  "ഡോ.": "tUm.",
  "ഡോക്ടർ": "tUmIvSÀ",
  "ഡോ": "tUm",

  // Departments
  "ജനറൽ മെഡിസിൻ": "PÈW¬ saUnkn³",
  "കാർഡിയോളജി": "ImÀUntbmfPn",
  "ദന്തവിഭാഗം": "Z´hn`mKw",
  "ഇ.എൻ.ടി വിഭാഗം": "C.F³.Sn hn`mKw",
  "ഇ.എൻ.ടി": "C.F³.Sn",
  "ഓർത്തോപീഡിക്സ്": "t\\mÀt¯m]oUnIvkv",
  "ജനറൽ ഒ.പി": "PÈW¬ OP",
  "ജനറൽ ഒ.പി.": "PÈW¬ OP",
  "ജനറൽ ഒ പി": "PÈW¬ OP",
  "ശിശു ദന്ത ചികിത്സ വിഭാഗം": "inip Z´ NnInÕm hn`mKw",
  "ശിശുദന്തചികിത്സാവിഭാഗം": "inip Z´ NnInÕm hn`mKw",
  "ശിശു ദന്ത വിഭാഗം": "inip Z´ hn`mKw",
  "ദന്ത ക്രമീകരണ വിഭാഗം": "Z´ {IaoIcW hn`mKw",
  "ദന്തക്രമീകരണവിഭാഗം": "Z´ {IaoIcW hn`mKw",
  "ഫിസിയോതെറാപി & റിഹാബിലിറ്റേഷൻ": "^nkntbmsXdm]n & dnlm_nentäj³",
  "ഫിസിയോതെറാപി": "^nkntbmsXdm]n",
  "റിഹാബിലിറ്റേഷൻ": "dnlm_nentäj³",

  // Weekdays
  "ഞായർ": "RmbÀ",
  "തിങ്കൾ": "Xn¦Ä",
  "ചൊവ്വ": "sNmÆ",
  "ബുധൻ": "_p[³",
  "വ്യാഴം": "hymgw",
  "വെള്ളി": "shÅn",
  "ശനി": "i\\n",

  // Months
  "ജനുവരി": "P\\phcn",
  "ഫെബ്രുവരി": "s^_phcn",
  "മാർച്ച്": "amÀ¨v",
  "ഏപ്രിൽ": "H{]nÂ",
  "മെയ്": "tabv",
  "ജൂൺ": "Pq¬",
  "ജൂലൈ": "Pqsse",
  "ആഗസ്റ്റ്": "BKÌv",
  "സെപ്റ്റംബർ": "sk]väw_À",
  "ഒക്ടോബർ": "HIvtSm_À",
  "നവംബർ": "\\hw_À",
  "ഡിസംബർ": "Unkw_À",

  // Common Qualifications
  "എം.ബി.ബി.എസ്": "Fw._n._n.Fkv",
  "എം.ബി.ബി.എസ്.": "Fw._n._n.Fkv.",
  "എം.ഡി": "Fw.Un",
  "എം.ഡി.": "Fw.Un.",
  "എം.എസ്": "Fw.Fkv",
  "എം.എസ്.": "Fw.Fkv.",
  "ഡി.എൻ.ബി": "Un.F³.n",
  "ഡി.എൻ.ബി.": "Un.F³.n.",
  "ബി.ഡി.എസ്": "_n.Un.Fkv",
  "ബി.ഡി.എസ്.": "_n.Un.Fkv.",
  "എം.ഡി.എസ്": "Fw.Un.Fkv",
  "എം.ഡി.എസ്.": "Fw.Un.Fkv.",
};

// 1. Independent Vowels
const VOWELS: Record<string, string> = {
  "അ": "A",
  "ആ": "B",
  "ഇ": "C",
  "ഈ": "D",
  "ഉ": "E",
  "ഊ": "F",
  "ഋ": "G",
  "എ": "F",
  "ഏ": "H",
  "ഐ": "sF",
  "ഒ": "H",
  "ഓ": "t\\m",
  "ഔ": "u",
};

// 2. Chillus
const CHILLUS: Record<string, string> = {
  "ൺ": "¬",
  "ൻ": "³",
  "ർ": "À",
  "ൽ": "Â",
  "ൾ": "¬",
  "ൿ": "Iv",
};

// 3. Consonants
const CONSONANTS: Record<string, string> = {
  "ക": "I",
  "ഖ": "J",
  "ഗ": "K",
  "ഘ": "L",
  "ങ": "§",
  "ച": "N",
  "ഛ": "O",
  "ജ": "P",
  "ഝ": "Q",
  "ഞ": "R",
  "ട": "S",
  "ഠ": "T",
  "ഡ": "U",
  "ഢ": "V",
  "ണ": "W",
  "ത": "X",
  "ഥ": "Y",
  "ദ": "Z",
  "ധ": "[",
  "ന": "\\",
  "പ": "]",
  "ഫ": "^",
  "ബ": "_",
  "ഭ": "`",
  "മ": "a",
  "യ": "b",
  "ര": "c",
  "ല": "e",
  "വ": "h",
  "ശ": "i",
  "ഷ": "j",
  "സ": "k",
  "ഹ": "l",
  "ള": "f",
  "ഴ": "g",
  "റ": "d",
};

// 4. Conjuncts (Consonant + ് + Consonant)
const CONJUNCTS: Record<string, string> = {
  "ക്ക": "¡",
  "ക്ല": "¢",
  "ക്ട": "£",
  "ക്ത": "¤",
  "ക്ഷ": "£",
  "ഗ്ഗ": "¥",
  "ഗ്ന": "¦",
  "ങ്ക": "¦",
  "ങ്ങ": "§",
  "ച്ച": "¨",
  "ഞ്ച": "©",
  "ഞ്ഞ": "ª",
  "ട്ട": "«",
  "ണ്ട": "ï",
  "ണ്ണ": "®",
  "ത്ത": "¯",
  "ത്ഭ": "Xv`",
  "ഥ്യ": "Yy",
  "ദ്ധ": "²",
  "ന്ത": "´",
  "ന്ദ": "µ",
  "ന്ന": "¶",
  "ന്മ": "·",
  "പ്പ": "¸",
  "പ്ല": "¹",
  "ബ്ബ": "_",
  "ബ്ധ": "_v[",
  "മ്പ": "¼",
  "മ്മ": "½",
  "ല്ല": "Ã",
  "ള്ള": "Å",
  "വ്വ": "Æ",
  "ശ്ല": "i\\",
  "ഷ്ണ": "jvW",
  "ഷ്ട": "Ì",
  "സ്സ": "Ê",
  "സ്റ്റ": "Ì",
  "സ്ഥ": "Ø",
  "സ്ന": "Ú",
  "സ്പ": "Û",
  "സ്മ": "Ü",
  "ത്സ": "Õ",
  "റ്റ": "ä",
  "ന്റ": "â",
  "ൻറ": "â",
};

// 5. Dependent Vowel Signs (Matras)
const MATRAS: Record<string, string> = {
  "ാ": "m",
  "ി": "n",
  "ീ": "o",
  "ു": "p",
  "ൂ": "q",
  "ൃ": "r",
  "്": "v",
  "ം": "w",
  "ഃ": "x",
};

/**
 * Normalizes Unicode text (removes hidden Zero-Width joiners/non-joiners and normalizes NFC)
 */
export function normalizeMalayalam(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFC")
    .replace(/\u200D/g, "") // ZWJ
    .replace(/\u200C/g, ""); // ZWNJ
}

/**
 * Convert a single word / token from Malayalam Unicode to MVM font encoding
 */
export function convertWordToMVM(word: string): string {
  if (!word) return "";
  if (KNOWN_PHRASES[word]) return KNOWN_PHRASES[word];

  const chars = Array.from(word);
  let result = "";
  let i = 0;

  while (i < chars.length) {
    // 1. Pure Chillus
    if (CHILLUS[chars[i]]) {
      result += CHILLUS[chars[i]];
      i++;
      continue;
    }

    // 2. Anusvara or Visarga at current index
    if (chars[i] === "ം") {
      result += "w";
      i++;
      continue;
    }
    if (chars[i] === "ഃ") {
      result += "x";
      i++;
      continue;
    }

    // 3. Independent Vowels
    if (VOWELS[chars[i]]) {
      result += VOWELS[chars[i]];
      i++;
      // Check if immediately followed by Anusvara (e.g. എം -> Fw)
      if (i < chars.length && chars[i] === "ം") {
        result += "w";
        i++;
      }
      continue;
    }

    // 4. Consonants and Syllable Clusters
    if (CONSONANTS[chars[i]]) {
      let cluster = chars[i];
      let preVowel = "";
      let postVowel = "";
      let hasRaSub = false;
      let hasYaSub = false;

      // Lookahead for Virama (്)
      if (i + 2 < chars.length && chars[i + 1] === "്") {
        const nextChar = chars[i + 2];

        // Subscript Ra (e.g., പ്ര, ക്ര, ദ്ര, ബ്ര)
        if (nextChar === "ര" || nextChar === "റ") {
          hasRaSub = true;
          cluster = CONSONANTS[chars[i]] || chars[i];
          i += 3; // consumed C + ് + ര
        }
        // Subscript Ya (e.g., പ്യ, ത‍്യ)
        else if (nextChar === "യ") {
          hasYaSub = true;
          cluster = CONSONANTS[chars[i]] || chars[i];
          i += 3; // consumed C + ് + യ
        }
        // Standard 2-consonant conjuncts (കൂട്ടക്ഷരങ്ങൾ)
        else {
          const conjunctKey = chars[i] + "്" + nextChar;
          if (CONJUNCTS[conjunctKey]) {
            cluster = CONJUNCTS[conjunctKey];
            i += 3;
          } else {
            // Fallback compound consonant
            cluster = (CONSONANTS[chars[i]] || chars[i]) + "v" + (CONSONANTS[nextChar] || nextChar);
            i += 3;
          }
        }
      } else {
        cluster = CONSONANTS[chars[i]];
        i++;
      }

      // Check for attached dependent vowel signs
      if (i < chars.length) {
        const matra = chars[i];
        if (matra === "െ") {
          preVowel = "s";
          i++;
        } else if (matra === "േ") {
          preVowel = "t";
          i++;
        } else if (matra === "ൈ") {
          preVowel = "ss";
          i++;
        } else if (matra === "ൊ") {
          preVowel = "s";
          postVowel = "m";
          i++;
        } else if (matra === "ോ") {
          preVowel = "t";
          postVowel = "m";
          i++;
        } else if (matra === "ൌ" || matra === "ൗ") {
          preVowel = "s";
          postVowel = "u";
          i++;
        } else if (MATRAS[matra]) {
          postVowel = MATRAS[matra];
          i++;
        }
      }

      // Check if cluster is followed by Anusvara (ം -> w)
      if (i < chars.length && chars[i] === "ം") {
        postVowel += "w";
        i++;
      }

      // Assemble cluster: preVowel + (optional ra-sub) + cluster + (optional ya-sub) + postVowel
      if (hasRaSub) {
        result += preVowel + "{" + cluster + (hasYaSub ? "y" : "") + postVowel;
      } else {
        result += preVowel + cluster + (hasYaSub ? "y" : "") + postVowel;
      }
      continue;
    }

    // Pass through non-Malayalam characters directly
    result += chars[i];
    i++;
  }

  return result;
}

/**
 * Main Export: Converts any Malayalam Unicode string into MVM (ML-TT) font encoding.
 * Can safely handle mixed English, numbers, doctor titles, punctuation, and qualifications.
 *
 * @param text Malayalam Unicode text (e.g. "ഡോ. രാഹുൽ കൃഷ്ണൻ")
 * @returns MVM font string (e.g. "tUm. cmlpÂ IrjvW³")
 */
export function unicodeToMVM(text: string): string {
  if (!text) return "";
  const cleaned = normalizeMalayalam(text);

  // Check full string known phrase first
  const trimmed = cleaned.trim();
  if (KNOWN_PHRASES[trimmed]) {
    return KNOWN_PHRASES[trimmed];
  }

  // Tokenize preserving spaces and punctuation
  const tokens = cleaned.split(/(\s+|[.,;()&/\-]+)/);
  return tokens.map((t) => convertWordToMVM(t)).join("");
}
