import React, { useState } from 'react';
import { xamun } from '../../utils/xamunHelper';
import { usePromptSubmission } from '../../hooks/usePromptSubmission';

interface Prompt {
  id: string;
  title: string;
  content: string;
}

interface PromptLibraryViewProps {
  onDone: () => void;
  isTab?: boolean;
  selectedFilePath?: string;
  onUsePrompt: (content: string) => void;
}

const PromptLibraryView: React.FC<PromptLibraryViewProps> = ({ onDone, isTab = false, selectedFilePath, onUsePrompt }) => {
  const [additionalText, setAdditionalText] = useState('');
  const { handlePromptUse } = usePromptSubmission();

  // This is a placeholder. We'll need to implement the actual fetching of prompts later.
  const predefinedPrompts: Prompt[] = [

    { id: '1', title: 'Explain File', content: 'Explain this file or folder' },

    {
      id: '2', title: 'Display data in the UI ',
      content: `
      You're an Angular front end developer expert and you are task to get the data from a backend api and display the results in the UI.
    
      I want to display data in the ui using an api. \n   
       - __addtionalText__  \n
       - Use the files in __path__ \n   

      ` },

    {
      id: '3', title: 'Create an Angular form and submit the data to Backend',
      content: `
        You're an Angular front end developer expert and you are task to create an Angular form that validates the form fields as required and then submit to the backend  api service.
        Use Angular ng validators and Angular material error in the UI for the required fields.
        __addtionalText__  \n
        Use the files in __path__ \n 
        ` },


    {
      id: '4', title: 'Display data with specified model ',
      content: `I want to display data in the ui using an api. \n
      I want you to follow the following steps to finish this task: \n  
      -if the __path__ is the same folder src/app/modules then create a new module
      -but if the path __path__ is not an html file and it is inside a module or feature folder or it is a module then create 
         a new component inside that module \n
      -if you can not determine what module the path is then create a new module or feature where you will create the new component \n
      -if the __path__ is an html file then try to update the file and that component do not create a new module or component \n
      -if not specify provide a sample api endpoint  to fetch data and update or create the service for the module \n
      -if json model is not provided then create a sample model based on module name or api endpoint or path name or based it on the name of other module name \n 
      -dont name it like 'module'

         \n __addtionalText__ 
         \n __jsonContent__      

      ` },
    {
      id: '5', title: 'Submit form with specified model',
      content: `Create an Angular form and submit the data to Backend . \n
      I want you to follow the following steps to finish this task: \n  
      -if the __path__ is the same folder src/app/modules then create a new module
      -but if the path __path__ is not an html file and it is inside a module or feature folder or it is a module then create 
         a new component inside that module \n
      -if you can not determine what module the path is then create a new module or feature where you will create the new component \n
      -if the __path__ is an html file then try to update the file and that component do not create a new module or component \n
      -if not specify provide a sample api endpoint  to submit data and update or create the service for the module \n
      -if json model is not provided then create a sample model based on module name or api endpoint or path name or based it on the name of other module name \n 
      -dont name it like 'module'

         \n __addtionalText__ 
         \n __jsonContent__      

      ` },


    { id: '6', title: 'Check for Bugs', content: 'Analyze the file for bugs...' },
    // Add more predefined prompts as needed
  ];

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    height: isTab ? '100vh' : 'auto',
    overflow: 'auto',
    backgroundColor: '#1e1e1e', // Dark background
    color: '#ffffff', // Light text
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '20px',
  };

  const headerTopStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  };

  const filePathStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#888888', // Light gray for file path
    marginBottom: '10px',
  };

  const listStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
  };

  const listItemStyle: React.CSSProperties = {
    backgroundColor: '#2d2d2d', // Darker item background
    border: '1px solid #3e3e3e', // Darker border
    borderRadius: '4px',
    padding: '10px',
    marginBottom: '10px',
  };

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '5px 10px',
    backgroundColor: disabled ? '#4a4a4a' : '#0e639c', // Darker blue when enabled, gray when disabled
    color: disabled ? '#a0a0a0' : 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  });

  const titleStyle: React.CSSProperties = {
    //color: '#d0ced2', // Light xamun for titles
    color: '#b278ec', // Light xamun for titles
  };

  const libTitleStyle: React.CSSProperties = {
    color: '#d0ced2', // Light xamun for titles
    //color: '#b278ec', // Light xamun for titles
  };

  const contentStyle: React.CSSProperties = {
    color: '#d4d4d4', // Light gray for content
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px',
    marginBottom: '10px',
    backgroundColor: '#3c3c3c',
    color: '#ffffff',
    border: '1px solid #555555',
    borderRadius: '4px',
  };

  const handleUsePrompt = (content: string) => {
    let thisPath = xamun.windowsToLinuxPath(selectedFilePath || '');
    content = content.replace('__path__', thisPath)
    content = content.replace('__addtionalText__', additionalText)
    content = content.replace('__jsonContent__', jsonContent)
    //repeat
    content = content.replace('__path__', thisPath)
    
    const fileContext = `${thisPath}`
    const combinedContent = `${content}\n${fileContext}`;

    console.log(combinedContent);

    handlePromptUse(combinedContent, onUsePrompt);
    if (!isTab) {
      onDone();
    }
  };

  const handlePrompt4 = (value: string = '') => {
    setAdditionalText('');
    let prompt = `\n -provide a sample api endpoint to fetch data and update or create the service for the module `

    if (value.length > 0) {
      prompt = `\n -use the api ${value} to fetch the data to display  create or update the service for the module \n`
      //prompt.replace('__addtionalText__', value)
    }

    setAdditionalText(prompt);
  };

  const handlePrompt3 = (value: string = '') => {
    setAdditionalText('');
    let prompt = `\n -provide a sample api endpoint to fetch data and update or create the service for the module `

    if (value.length > 0) {
      prompt = `\n -use the api ${value} to post the data.
      create or update the service for the module \n`
      //prompt.replace('__addtionalText__', value)
    }

    setAdditionalText(prompt);
  };


  const [jsonContent, setJsonContent] = useState<string>(''); // State for JSON content
  const [isJsonValid, setIsJsonValid] = useState<boolean>(false); // Track JSON validity


  const handleJsonChange = (value: string) => {
    setJsonContent('');
    //setIsJsonValid(value.trim().length > 0); // Validate JSON content is non-empty
    let prompt = `\n -use the model \n`
    prompt += value;
    setJsonContent(prompt);
  };


  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerTopStyle}>
          <h2 style={libTitleStyle}>Prompt Library</h2>
          {!isTab && <button style={buttonStyle(false)} onClick={onDone}>Close</button>}
        </div>
        {selectedFilePath && (
          <div style={filePathStyle}>
            Selected file: {selectedFilePath}
          </div>
        )}
      </div>
      {/* <input
        type="text"
        placeholder="Enter additional context here..."
        value={additionalText}
        onChange={(e) => setAdditionalText(e.target.value)}
        style={inputStyle}
      /> */}
      <ul style={listStyle}>
        {predefinedPrompts.map((prompt) => (
          <li key={prompt.id} style={listItemStyle}>
            <h3 style={titleStyle}>{prompt.id}.&nbsp;{prompt.title}</h3>
            <p style={contentStyle}>{prompt.content.substring(0, 100)}...</p>

            {/* Conditionally render input if the prompt id is '2' */}
            {(prompt.id === '4' || prompt.id === '5') && (
              <>
                <input
                  type="text"
                  placeholder="Enter api endpoint/url to use..."
                  style={inputStyle}
                  //value={additionalText}
                  onChange={(e) => handlePrompt4(e.target.value)}
                />

                <label style={{ color: isJsonValid ? '#d4d4d4' : '#ff4d4d', marginBottom: '5px', display: 'block' }}>
                  api JSON result(model) sample:
                </label>
                <textarea
                  placeholder="Paste JSON or model descriptions..."
                  style={{ ...inputStyle, height: '100px', borderColor: isJsonValid ? '#555555' : '#ff4d4d' }}
                  // value={jsonContent}
                  onChange={(e) => handleJsonChange(e.target.value)}
                />
              </>
            )}

             {/* Conditionally render input if the prompt id is '5' */}
             {(prompt.id === '2') && (
              <>
                <input
                  type="text"
                  placeholder="Enter api endpoint/url to use..."
                  style={inputStyle}
                  //value={additionalText}
                  onChange={(e) => handlePrompt4(e.target.value)}
                />
            
              </>
            )}

            {/* Conditionally render input if the prompt id is '2' */}
              {(prompt.id === '3') && (
              <>
                <input
                  type="text"
                  placeholder="Enter api endpoint/url to use..."
                  style={inputStyle}
                  //value={additionalText}
                  onChange={(e) => handlePrompt3(e.target.value)}
                />
            
              </>
            )}


            <button
              style={buttonStyle(!selectedFilePath)}
              onClick={() => handleUsePrompt(prompt.content)}
              disabled={!selectedFilePath}
            >
              Use Prompt
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PromptLibraryView;
