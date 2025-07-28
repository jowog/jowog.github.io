async function loadData() {
    try {
        let [booksResponse, versesResponse] = await Promise.all([ // Počkáme na odpověď
            fetch(`https://jowog.github.io/bible-odkazy/book-names_${LANG}.json`),
            fetch("https://jowog.github.io/bible-odkazy/verse-renum.json")
        ]);

        if (!booksResponse.ok || !versesResponse.ok) {
            throw new Error(`Chyba při načítání JSON: ${booksResponse.status}, ${versesResponse.status}`);
        }

        let bookList = await booksResponse.json(); // Počkáme na převod dat do JSON
        let renumList = await versesResponse.json();

        return { bookList, renumList };
    } catch (error) {
        //console.error("Chyba při načítání dat:", error);
        throw error; // Vyhodíme chybu pro zpracování v .catch
    }
}

function parseGroups(input, delim) {
    // Nahrazení všech nalezených pomlček běžnou pomlčkou "-"
    input = input.replace(/[\u2010-\u2015]/g, "-");

    // Regulární výraz pro identifikaci začátku skupiny
    const regex = new RegExp(`\\d+\\s*${delim[0]}`, "g");

    // Vyhledání indexů začátků skupin
    const matches = [...input.matchAll(regex)].map(match => match.index);

    // Rozdělení na skupiny podle nalezených indexů
    const groups = [];
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i];
        const end = matches[i + 1] || input.length; // Konec je další index nebo konec řetězce
        let group = input.slice(start, end);

        // Odstranění oddělovačů na konci skupiny
        //group = group.replace(/[\s,;.]+$/, "");
        group = group.replace(/[^\d]+$/, "");

        groups.push(group);
    }

    let parsedReferences = [];

    const regexSplit = new RegExp(`[${delim[1]};]`);
    groups.forEach(group => {
        // Rozdělení kapitol a veršů
        const [chapter, verses] = group.split(delim[0]);
        if (verses) {
            verses.split(regexSplit).forEach(verse => {
                parsedReferences.push(`${chapter.trim()}:${verse.trim()}`);
            });
        }
    });

    return parsedReferences;
}

function createHref(abbrev, ref) {
    const [chapter, verse] = ref.split(":");
    const range = verse.split("-");
    let href;
    if (range.length === 2) {
        // Pokud je to rozsah veršů
        const versOd = range[0]; // První verš
        const versDo = range[1]; // Poslední verš
        href = `https://obohu.cz/odkaz_csp-gntv-bh.php?k=${abbrev}&kap=${chapter}&v=${versOd}&kv=${versDo}&csp_poznamky=ano`;
    } else {
        // Pokud je to samostatný verš
        const singleVerse = verse;
        href = `https://obohu.cz/odkaz_csp-gntv-bh.php?k=${abbrev}&kap=${chapter}&v=${singleVerse}&csp_poznamky=ano`;
    }

    return href;
}

function verseRenum(abbrev, groups, renumList) {
    const renumArray = [];

    groups.forEach(input => {
        const inputArray = input.split(":");
        const inputVerseArray = inputArray[1].split("-");

        const inputObject = {
           kniha: abbrev,
           kapitolaOd: inputArray[0],
           versOd: inputVerseArray[0],
           kapitolaDo: "",
           versDo: ""
        };
        if (inputVerseArray.length > 1) {
            inputObject.kapitolaDo = inputArray[0];
            inputObject.versDo = inputVerseArray[1];
        }

        const renumObject = { ...inputObject }; // Mělká kopie
        // const renumObject = structuredClone(inputObject); // Hluboká kopie

        if (inputVerseArray.length === 1) {
            const searchStr = `${inputObject.kniha}-${inputObject.kapitolaOd}-${inputObject.versOd}`
            const found = renumList.find(item => item.eng === searchStr);
            if (found) {
                const foundArray = found.cz.split("-");
                renumObject.kniha = foundArray[0];
                renumObject.kapitolaOd = foundArray[1];
                renumObject.versOd = foundArray[2];
                renumObject.kapitolaDo = foundArray[3];
                renumObject.versDo = foundArray[4];
            }
        } else {
            const searchStrOd = `${inputObject.kniha}-${inputObject.kapitolaOd}-${inputObject.versOd}`
            let found = renumList.find(item => item.eng === searchStrOd);
            if (found) {
                const foundArray = found.cz.split("-");
                renumObject.kniha = foundArray[0];
                renumObject.kapitolaOd = foundArray[1];
                renumObject.versOd = foundArray[2];
            }

            const searchStrDo = `${inputObject.kniha}-${inputObject.kapitolaDo}-${inputObject.versDo}`
            found = renumList.find(item => item.eng === searchStrDo);
            if (found) {
                const foundArray = found.cz.split("-");
                if (foundArray[3]) {
                    renumObject.kapitolaDo = foundArray[3];
                    renumObject.versDo = foundArray[4];
                } else {
                    renumObject.kapitolaDo = foundArray[1];
                    renumObject.versDo = foundArray[2];
                }
            }
        }


        if (renumObject.kapitolaDo && renumObject.kapitolaOd !== renumObject.kapitolaDo) {
            //renumArray.push("error");
        } else {
            if (renumObject.kapitolaOd === renumObject.kapitolaDo && renumObject.versOd === renumObject.versDo) {
                renumObject.kapitolaDo = "";
                renumObject.versDo = "";
            }
            if (renumObject.versDo) {
                const renumStr = `${renumObject.kapitolaOd}:${renumObject.versOd}-${renumObject.versDo}`;
                renumArray.push(renumStr);
            } else {
                const renumStr = `${renumObject.kapitolaOd}:${renumObject.versOd}`;
                renumArray.push(renumStr);
            }
        }
    });

    return renumArray;
}

function createAnchor(matched, kniha, verse, bookList, renumList, delim, isObj) {
    const abbrev = bookList.find(item => item.bookName.toLowerCase() === kniha.toLowerCase()).abbrev;
    let groups = parseGroups(verse, delim);
    //console.log(groups);
    if (LANG === "EN") groups = verseRenum(abbrev, groups, renumList);
    if (groups.length === 0) {
        if (isObj)
            return null;
        else
            return "";
    }
    //console.log(groups);
    //console.log("Hotovo");

    let href = ""
    let anchorStr = ""
    let allHyperlinks = ""; // Proměnná pro uložení všech odkazů

    if (groups.length === 1) {
        const ref = groups[0];
        href = createHref(abbrev, ref);
        anchorStr = `<a href="${href}" data-fancybox data-type="iframe" data-preload="false" data-width="750" data-height="400">${matched}</a>`;
    } else {
        groups.forEach(ref => {
            href = createHref(abbrev, ref);

           // Vytvoření hypertextového odkazu
           const hyperlink = `<a href="${href}" data-fancybox data-type="iframe" data-preload="false" data-width="750" data-height="400">${abbrev} ${ref}</a> `;
           allHyperlinks += hyperlink; // Přidání odkazu do proměnné allHyperlinks
        });
        anchorStr = `${matched.trim()} [${allHyperlinks.trim()}] `;
    }

    if (isObj) {
        anchorObj = document.createElement('a');
        anchorObj.href = href;
        anchorObj.textContent = ' SOB';
        anchorObj.setAttribute('data-fancybox', '');
        anchorObj.setAttribute('data-type', 'iframe');
        anchorObj.setAttribute('data-preload', 'false');
        anchorObj.setAttribute('data-width', '750');
        anchorObj.setAttribute('data-height', '400');

        return anchorObj;
    } else {
        return anchorStr;
    }
}


const startTime = performance.now(); // Zaznamenání času spuštění programu

const LANG = document.getElementById('bible-odkazy').getAttribute('lang');

loadData().then(({ bookList, renumList }) => {
    // Převod seznamu knih na regulární výraz
    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    //const bookList = data.map(item => item.položka2);
    const bookPattern = bookList.map(book => escapeRegExp(book.bookName)).join("|");

    let regexes = [
        { regex: new RegExp(`^(${bookPattern})\\.?\\s*((\\d+)\\s*:\\s*\\d+(?:[\u2010-\u2015-]\\d+)*)$`, "i"), delim: [ ":", "," ] }, // J 3:16
        { regex: new RegExp(`^(${bookPattern})\\.?\\s*((\\d+)\\s*,\\s*\\d+(?:[\u2010-\u2015-]\\d+)*)$`, "i"), delim: [ ",", "." ] }  // J 3,16
    ];

    regexes.forEach(({ regex, delim }) => {
        const anchors = document.body.querySelectorAll("a"); // Získání všech tagů <a>

        const singleVerse = document.getElementById('bible-odkazy').getAttribute('single-verse');
        let matched, kniha, verse, kapitola, newAnchor;

        anchors.forEach(anchor => {
            if (anchor.id.startsWith('ftnLink') || anchor.closest('sup')) {
                return;
            }

            const match1 = anchor.innerHTML.trim().match(regex);

            if (match1) {
                [matched, kniha, verse, kapitola] = match1;
                newAnchor = createAnchor(matched, kniha, verse, bookList, renumList, delim, true);

                if (newAnchor) {
                    //const space = document.createTextNode(' '); // Vytvoření mezery
                    //anchor.parentNode.insertBefore(space, anchor.nextSibling); // Přidání mezery za odkaz
                    //anchor.parentNode.insertBefore(newAnchor, space.nextSibling); // Přidání nového odkazu za mezeru
                    anchor.insertAdjacentElement('afterend', newAnchor); // Přidání nového odkazu
                }
                return;
            }

            const match2 = anchor.innerHTML.trim().match(new RegExp(`^(\\d+)\\s*${delim[0]}\\s*\\d+(?:[\u2010-\u2015-]\\d+)*$`));

            if (kniha && match2) {
                [matched, kapitola] = match2;
                verse = matched;
                newAnchor = createAnchor(matched, kniha, verse, bookList, renumList, delim, true);

                if (newAnchor) anchor.insertAdjacentElement('afterend', newAnchor); // Přidání nového odkazu
                return;
            }

            if (singleVerse === "yes") {
               const match3 = anchor.innerHTML.trim().match(new RegExp(`^(?:verse|verses|verš|verše)?\\s*(\\d+(?:[\u2010-\u2015-]\\d+)*)$`));

               if (kniha && match3) {
                   let versecis;
                   [matched, versecis] = match3;
                   verse = `${kapitola}${delim[0]}${versecis}`;
                   newAnchor = createAnchor(matched, kniha, verse, bookList, renumList, delim, true);

                   if (newAnchor) anchor.insertAdjacentElement('afterend', newAnchor); // Přidání nového odkazu
                   return;
               }
            }

            matched = kniha = verse = kapitola = "";
            newAnchor = null;
        });
    });


    regexes = [
        { regexPart: new RegExp(`(?<![a-zA-Zá-žÁ-Ž0-9])(?:${bookPattern})\\.?\\s*\\d+\\s*:\\s*\\d`, "gi"),
          regex: new RegExp(`(?<![a-zA-Zá-žÁ-Ž0-9])(${bookPattern})\\.?\\s*(\\d+\\s*:[\\d\\s:,;\u2010-\u2015-]*\\d)`, "i"),  // J 3:16,17
          delim: [ ":", "," ]
        },
        { regexPart: new RegExp(`(?<![a-zA-Zá-žÁ-Ž0-9])(?:${bookPattern})\\.?\\s*\\d+\\s*,\\s*\\d`, "gi"),
          regex: new RegExp(`(?<![a-zA-Zá-žÁ-Ž0-9])(${bookPattern})\\.?\\s*(\\d+\\s*,[\\d\\s,.;\u2010-\u2015-]*\\d)`, "i"),  // J 3,16.17
          delim: [ ",", "." ]
        }
    ];

    regexes.forEach(({ regexPart, regex, delim }) => {
        const elements = document.body.getElementsByTagName('*');

        for (const element of elements) {
            // Ignorovat už existující tagy <a>
            if (element.tagName.toLowerCase() === 'a') continue;

            for (const node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && !element.hasAttribute('data-processed')) {
                    const textContent = node.textContent;

                    const pozice = [...textContent.matchAll(regexPart)].map(({ index }) => index);
                    if (pozice.length === 0) continue;

                    let updatedContent = textContent.substring(0, pozice[0]);

                    let found = false;
                    for (let i = 0; i < pozice.length; i++) {
                        let start = pozice[i];
                        let end = (i + 1 < pozice.length) ? pozice[i + 1] : textContent.length;
                        let castText = textContent.substring(start, end);

                        updatedContent += castText.replace(regex, (matched, kniha, verse) => {
                            found = true;
                            const anchorStr = createAnchor(matched, kniha, verse, bookList, renumList, delim, false);
                            if (anchorStr)
                                return anchorStr;
                            else
                                return matched;
                        });
                    }

                    if (found) {
                        const newNode = document.createElement('span');
                        newNode.innerHTML = updatedContent;
                        node.parentNode.replaceChild(newNode, node);
                        newNode.setAttribute('data-processed', 'true'); // Označení, že už byl upraven
                    }
                }
            }
            if (element.hasAttribute('data-processed')) {
                element.removeAttribute('data-processed');
            }
        }
    });

})
.catch(error => {
    console.error("Program ukončen kvůli chybě:", error.message);
    // Zamezení dalšího běhu kódu, ale nezavře samotný prohlížeč
    //alert("Došlo k chybě při načítání knih. Zkontrolujte konzoli.");
});

const endTime = performance.now(); // Zaznamenání času dokončení programu

const executionTime = endTime - startTime; // Výpočet celkové doby běhu programu

//console.log(`Čas spuštění: ${startTime} ms`);
//console.log(`Čas dokončení: ${endTime} ms`);
console.log(`Celková doba běhu programu: ${executionTime.toFixed(2)} ms`);
