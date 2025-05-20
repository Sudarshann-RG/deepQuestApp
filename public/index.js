document.getElementById("submit").addEventListener("click", async function(e) {
    e.preventDefault(); 
    console.log("Button clicked!");

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
                const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
                
                function markdownToDocxParagraphs(markdown) {
                    const lines = markdown.split('\n');
                    const paragraphs = [];

                    for (const line of lines) {
                        if (line.startsWith('### ')) {
                            paragraphs.push(new Paragraph({
                                text: line.replace('### ', ''),
                                heading: HeadingLevel.HEADING_3,
                                spacing: { after: 200 }
                            }));
                        } else if (line.startsWith('## ')) {
                            paragraphs.push(new Paragraph({
                                text: line.replace('## ', ''),
                                heading: HeadingLevel.HEADING_2,
                                spacing: { after: 200 }
                            }));
                        } else if (line.startsWith('# ')) {
                            paragraphs.push(new Paragraph({
                                text: line.replace('# ', ''),
                                heading: HeadingLevel.HEADING_1,
                                spacing: { after: 300 }
                            }));
                        } else if (line.trim() === '---') {
                            // Horizontal rule as empty space
                            paragraphs.push(new Paragraph({ spacing: { after: 300 } }));
                        } else if (line.trim().length > 0) {
                            paragraphs.push(new Paragraph({
                                children: [new TextRun(line)],
                                spacing: { after: 200 }
                            }));
                        }
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
