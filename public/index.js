document.getElementById("submit").addEventListener("click", async function(e) {
    e.preventDefault(); 
    console.log("Button clicked!");

    if(document.querySelector('.download-button') != undefined)
    {
        document.querySelector('.download-button').remove();
    }

    document.querySelector('#response').innerHTML = "";
    document.querySelector('#stepsProgressList').innerHTML = "";
    document.querySelector('button').style.color = "grey";
    document.querySelector('.promptBlock').style.opacity = "0.5";
    
    var responseBlock = document.querySelector('#responseBlock');
    responseBlock.style.height = "0";
    void responseBlock.offsetHeight; 
    responseBlock.style.height = "500px";

    setTimeout(() => {
        var dotlottiePlayer = document.createElement('dotlottie-player');
        dotlottiePlayer.setAttribute('src', 'https://lottie.host/c669f4d8-e435-4fa0-8ed6-520e2f062856/HQNOJK9lDy.lottie');
        dotlottiePlayer.setAttribute('autoplay', '');
        dotlottiePlayer.setAttribute('loop', '');
        dotlottiePlayer.setAttribute('speed', '1');
        dotlottiePlayer.setAttribute('background', 'transparent');
        dotlottiePlayer.setAttribute('style', 'width: 200px; height: 200px; position: absolute; top: 17%; left: 40%; ransform: translate(-50%, -50%); z-index: 9999;');
        document.querySelector('#responseBlock').appendChild(dotlottiePlayer);
        var progressMessage = document.createElement('p');
        progressMessage.className = "progress-message";
        progressMessage.innerHTML = "Generating Report....";
        document.querySelector('#responseBlock').appendChild(progressMessage);
    }, 1000);

    document.querySelector('.promptBlock').style.order = "4";
    document.querySelector('#responseBlock').style.order = "3";
    document.querySelector('#container-2').style.justifyContent = "flex-start";
    document.querySelector('.promptBlock').style.justifySelf = "flex-end";

    const prompt = document.getElementById("prompt").value;
    document.getElementById("prompt").value = "";
    try {
        const response = await fetch("/api/research", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ topic: prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);


        document.querySelector('dotlottie-player').remove();
        document.querySelector('.progress-message').remove();

        document.querySelector('.promptBlock').style.opacity = "1";
        document.querySelector('#container-2').style.height = "max-content";
        await renderMarkdownSteps(data.past_steps[0].length, data);

        setTimeout(async () => {
            const markdown = data.response;
            const html = marked.parse(markdown);

            document.getElementById('responseBlock').style.width = "55em";
            document.getElementById('responseBlock').style.margin = "20px";
            document.getElementById('responseBlock').style.borderRadius = "1rem";
            document.getElementById('response').style.height = "max-content";
            document.getElementById("response").innerHTML = html;
            
            var downloadButton = document.createElement("button");
            downloadButton.className = "download-button";
            responseBlock.appendChild(downloadButton);
            document.querySelector('.download-button').innerHTML = 'Download Report <i id="download-icon" data-lucide="download"></i>';
            downloadButton.addEventListener("click", async () => {
                if (!window.docx) {
                    alert("Failed to load document generator. Please refresh the page and try again.");
                    return;
                }

                const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
                
                function markdownToDocxParagraphs(markdown) {
                    const lines = markdown.split('\n');
                    const paragraphs = [];

                    let currentParagraph = null;
                    let carryoverLinkText = null;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        if (!line) {
                            if (currentParagraph) {
                                paragraphs.push(currentParagraph);
                                currentParagraph = null;
                            }
                            continue;
                        }

                        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : null;

                        // Heading detection
                        const headingMatch = /^(#{1,4})\s+(.*)/.exec(line);
                        if (headingMatch) {
                            const level = headingMatch[1].length;
                            const content = headingMatch[2];

                            paragraphs.push(new docx.Paragraph({
                                text: content,
                                heading: docx[`HeadingLevel`][`HEADING_${level}`],
                                spacing: { after: 100 + (level * 50) }
                            }));
                            continue;
                        }

                        const runs = [];
                        let lastIndex = 0;

                        const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|([^\s]+\s*\(https?:\/\/[^\s)]+\))/g;
                        let match;

                        while ((match = regex.exec(line)) !== null) {
                            // Add plain text before this match
                            if (match.index > lastIndex) {
                                runs.push(new docx.TextRun(line.substring(lastIndex, match.index)));
                            }

                            if (match[1]) {
                                // [text](url)
                                runs.push(new docx.ExternalHyperlink({
                                    link: match[3],
                                    children: [new docx.TextRun({ text: match[2], style: "Hyperlink" })]
                                }));
                            } else if (match[4]) {
                                // **bold**
                                runs.push(new docx.TextRun({ text: match[5], bold: true }));
                            } else if (match[6]) {
                                // *italic*
                                runs.push(new docx.TextRun({ text: match[7], italics: true }));
                            } else if (match[8]) {
                                // `code`
                                runs.push(new docx.TextRun({ text: match[9], font: "Courier New", size: 20 }));
                            } else if (match[10]) {
                                // "Text (https://...)" pattern
                                const textMatch = match[10].match(/^(.+?)\s*\((https?:\/\/[^\s)]+)\)/);
                                if (textMatch) {
                                    runs.push(new docx.ExternalHyperlink({
                                        link: textMatch[2],
                                        children: [new docx.TextRun({ text: textMatch[1], style: "Hyperlink" })]
                                    }));
                                } else {
                                    runs.push(new docx.TextRun(match[10]));
                                }
                            }

                            lastIndex = regex.lastIndex;
                        }

                        // Add trailing text if any
                        if (lastIndex < line.length) {
                            runs.push(new docx.TextRun(line.substring(lastIndex)));
                        }

                        // Handle "Link label" followed by "https://..." on next line
                        if (/^\w.+:$/.test(line) && nextLine && /^https?:\/\//.test(nextLine)) {
                            runs.push(new docx.ExternalHyperlink({
                                link: nextLine,
                                children: [new docx.TextRun({ text: line.replace(':', ''), style: "Hyperlink" })]
                            }));
                            i++; // Skip the URL line
                        }

                        currentParagraph = new docx.Paragraph({
                            children: runs,
                            spacing: { after: 200 }
                        });
                        paragraphs.push(currentParagraph);
                        currentParagraph = null;
                    }

                    return paragraphs;
                }

                try {
                    // Create a new Document with proper structure
                    const doc = new Document({
                        creator: "deepQuest",
                        title: "Research Report",
                        description: "Generated by deepQuest AI",
                        sections: [{
                            properties: {},
                            children: [
                                new Paragraph({
                                    text: "Research Report: " + prompt,
                                    heading: HeadingLevel.HEADING_1,
                                    spacing: { after: 200 },
                                }),
                                ...markdownToDocxParagraphs(data.response)
                            ],
                        }],
                    });

                    // Generate and download the document
                    const blob = await Packer.toBlob(doc);
                    saveAs(blob, "deepQuest_Report.docx");
                } catch (err) {
                    console.error("Error generating document:", err);
                    alert("Failed to generate document. Please try again.");
                }

            });
            void responseBlock.offsetHeight; 
            document.querySelector(".response-block").style.height = 'auto';

            setTimeout(() => {
                const anchors = document.querySelectorAll("#response a");
                anchors.forEach(anchor => {
                    console.log("Anchor found:", anchor);
                    const icon = document.createElement("i");
                    icon.setAttribute("data-lucide", "link");
                    icon.style.marginLeft = "5px";
                    icon.style.color = '#00C4FF';
                    icon.style.verticalAlign = "middle";
                    anchor.after(icon);
                });
                lucide.createIcons();
            }, 0);
            document.getElementById("response").style.margin = '0px';
        });

    } catch (error) {
        console.error("Fetch error:", error);
    }
});

function renderMarkdownSteps(length, data) {
    return new Promise((resolve) => {
        const progressList = document.getElementById("stepsProgressList");
        progressList.innerHTML = "";  
        const allSteps = [];

        for (let i = 0; i < length; i++) {
            const markdown = data.past_steps[0][i];
            const html = marked.parse(markdown);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const h3s = Array.from(doc.querySelectorAll("h3"));
            h3s.forEach(h3 => allSteps.push(h3.textContent));
        }

        allSteps.forEach((stepTitle, i) => {
            setTimeout(() => {
                const li = document.createElement("li");
                li.className = "step-progress";
                li.textContent = stepTitle;
                progressList.appendChild(li);

                if (i === allSteps.length - 1) {
                    setTimeout(() => {
                        resolve(); 
                    }, 600); 
                }
            }, i * 600);
        });

        if (allSteps.length === 0) {
            resolve();
        }
    });
}

window.onload = () => {
    lucide.createIcons();
}

document.getElementById("prompt").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); 
        document.getElementById("submit").click(); 
    }
});
