import PyPDF2

def extract():
    with open('/Users/harshithgowda/Desktop/DevHeal/OmniDev — Final.pdf', 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
    with open('/Users/harshithgowda/Desktop/DevHeal/pdf-parser/output.txt', 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == '__main__':
    extract()
