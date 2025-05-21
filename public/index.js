const submitBtn = document.getElementById("submit");
const promptInput = document.getElementById("prompt");
const responseBlock = document.getElementById("responseBlock");
const responseEl = document.getElementById("response");
const stepsList = document.getElementById("stepsProgressList");
const promptBlock = document.querySelector(".promptBlock");
const container = document.getElementById("container-2");

document.getElementById("submit").addEventListener("click", async function(e) {
    e.preventDefault(); 
    console.log("Button clicked!");

    const oldBtn = document.querySelector('.download-button');
    if (oldBtn) oldBtn.remove();

    responseEl.innerHTML = "";
    stepsList.innerHTML = "";
    submitBtn.style.color = "grey";
    promptBlock.style.opacity = "0.5";
    
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
        dotlottiePlayer.className = 'lottie-spinner';
        document.querySelector('#responseBlock').appendChild(dotlottiePlayer);

        var progressMessage = document.createElement('p');
        progressMessage.className = "progress-message";
        progressMessage.innerHTML = "Generating Report....";
        responseBlock.appendChild(progressMessage);
    }, 500);

    promptBlock.style.order = "4";
    responseBlock.style.order = "3";
    container.style.justifyContent = "flex-start";
    promptBlock.style.justifySelf = "flex-end";

    const prompt = promptInput.value.trim();
    promptInput.value = "";
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

        promptBlock.style.opacity = "1";
        container.style.height = "max-content";
        await renderMarkdownSteps(data.past_steps[0].length, data);

        setTimeout(async () => {
            const markdown = data.response;
            const html = DOMPurify.sanitize(marked.parse(markdown));

            responseBlock.style.width = "55em";
            responseBlock.style.margin = "20px";
            responseBlock.style.borderRadius = "1rem";
            responseEl.style.height = "max-content";
            responseEl.innerHTML = html;
            
            var downloadButton = document.createElement("button");
            downloadButton.className = "download-button";
            downloadButton.innerHTML = 'Download Report <i id="download-icon" data-lucide="download"></i>';
            responseBlock.appendChild(downloadButton);
            
            downloadButton.addEventListener("click", async () => generateDocx(prompt, data.response));
            
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
            responseEl.style.margin = '0px';
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

function markdownToDocxParagraphs(markdown) {
    const { Paragraph, TextRun, ExternalHyperlink, HeadingLevel } = window.docx;
    const lines = markdown.split('\n');
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1]?.trim();

        if (!line) continue;

        const headingMatch = /^(#{1,4})\s+(.*)/.exec(line);
        if (headingMatch) {
            paragraphs.push(new Paragraph({
                text: headingMatch[2],
                heading: HeadingLevel[`HEADING_${headingMatch[1].length}`],
                spacing: { after: 100 }
            }));
            continue;
        }

        const runs = [];
        let match;
        const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|([^\s]+\s*\(https?:\/\/[^\s)]+\))/g;
        let lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
            if (match.index > lastIndex) runs.push(new TextRun(line.substring(lastIndex, match.index)));
            if (match[1]) runs.push(new ExternalHyperlink({ link: match[3], children: [new TextRun({ text: match[2], style: "Hyperlink" })] }));
            else if (match[4]) runs.push(new TextRun({ text: match[5], bold: true }));
            else if (match[6]) runs.push(new TextRun({ text: match[7], italics: true }));
            else if (match[8]) runs.push(new TextRun({ text: match[9], font: "Courier New", size: 20 }));
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < line.length) runs.push(new TextRun(line.substring(lastIndex)));
        paragraphs.push(new Paragraph({ children: runs, spacing: { after: 200 } }));
    }

    return paragraphs;
}

async function generateDocx(prompt, markdown) {
    const { Document, Packer, Paragraph, HeadingLevel } = window.docx;
    const doc = new Document({
        creator: "deepQuest",
        title: "Research Report",
        description: "Generated by deepQuest AI",
        sections: [{
            properties: {},
            children: [
                new Paragraph({ text: "Research Report: " + prompt, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
                ...markdownToDocxParagraphs(markdown)
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "deepQuest_Report.docx");
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
