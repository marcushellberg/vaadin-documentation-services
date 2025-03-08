/**
 * AsciiDoc processor for converting AsciiDoc content directly to Markdown
 * Uses a custom approach to handle includes before passing to downdoc
 * 
 * This implementation addresses the limitation of downdoc, which doesn't support includes
 * and simply omits them. Instead, we manually process includes first, then use asciidoctor
 * to handle conditionals, and finally use downdoc to convert to Markdown.
 * 
 * Reference: https://github.com/opendevise/downdoc#limitations
 * "include directives are dropped. However, you can first run the document through 
 * Asciidoctor Reducer to incorporate the content from any included files."
 */

import asciidoctor from 'asciidoctor';
import downdoc from 'downdoc';
import { config } from './config';
import fs from 'fs';
import path from 'path';

// Initialize Asciidoctor processor
const processor = asciidoctor();

/**
 * Resolves an include path based on attributes and base directory
 * @param includePath - The include path from the directive
 * @param attributes - The attributes object
 * @param baseDir - The base directory
 * @returns The resolved file path
 */
function resolveIncludePath(includePath: string, attributes: Record<string, any>, baseDir: string): string {
  // Replace attribute references in the include path
  let resolvedPath = includePath;
  
  // Handle attribute references like {root}, {articles}, etc.
  Object.entries(attributes).forEach(([key, value]) => {
    resolvedPath = resolvedPath.replace(new RegExp(`\\{${key}\\}`, 'g'), value.toString());
  });
  
  // If the path is not absolute, resolve it relative to the base directory
  if (!path.isAbsolute(resolvedPath)) {
    resolvedPath = path.resolve(baseDir, resolvedPath);
  }
  
  return resolvedPath;
}

/**
 * Processes include directives in AsciiDoc content
 * @param content - The AsciiDoc content
 * @param attributes - The attributes object
 * @param baseDir - The base directory
 * @param processedFiles - Set of already processed files to prevent circular includes
 * @returns The processed content with includes expanded
 */
function processIncludes(
  content: string, 
  attributes: Record<string, any>, 
  baseDir: string,
  processedFiles = new Set<string>()
): string {
  // Regular expression to match include directives
  // Format: include::{path}[optional-attributes]
  const includeRegex = /include::([^[\]]+)(?:\[(.*?)\])?/g;
  
  // Process all include directives
  let result = content;
  let match;
  
  while ((match = includeRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const includePath = match[1];
    const includeAttributes = match[2] || '';
    
    try {
      // Resolve the include path
      const resolvedPath = resolveIncludePath(includePath, attributes, baseDir);
      
      // Check for circular includes
      if (processedFiles.has(resolvedPath)) {
        console.warn(`Circular include detected: ${resolvedPath}`);
        result = result.replace(fullMatch, `// Circular include skipped: ${includePath}`);
        continue;
      }
      
      // Read the included file
      if (fs.existsSync(resolvedPath)) {
        let includedContent = fs.readFileSync(resolvedPath, 'utf-8');
        
        // Add this file to the set of processed files
        processedFiles.add(resolvedPath);
        
        // Process includes in the included file (recursive)
        includedContent = processIncludes(
          includedContent, 
          attributes, 
          path.dirname(resolvedPath),
          processedFiles
        );
        
        // Handle include attributes like tags
        if (includeAttributes.includes('tags=')) {
          const tagsMatch = /tags=([^,]+)/.exec(includeAttributes);
          if (tagsMatch) {
            const tag = tagsMatch[1];
            // Extract content between tag markers
            // Support multiple comment styles:
            // 1. Standard comments: // tag::name[]
            // 2. HTML comments: <!-- tag::name[] -->
            // 3. JSX/React comments: {/* tag::name[] */}
            const tagPatterns = [
              `// tag::${tag}\\[\\]([\\s\\S]*?)// end::${tag}\\[\\]`,
              `<!-- tag::${tag}\\[\\] -->([\\s\\S]*?)<!-- end::${tag}\\[\\] -->`,
              `\\{/\\* tag::${tag}\\[\\] \\*/\\}([\\s\\S]*?)\\{/\\* end::${tag}\\[\\] \\*/\\}`
            ];
            
            let taggedContent = '';
            
            // Try each pattern until we find matches
            for (const pattern of tagPatterns) {
              const tagRegex = new RegExp(pattern, 'g');
              let tagMatch;
              let patternMatched = false;
              
              while ((tagMatch = tagRegex.exec(includedContent)) !== null) {
                taggedContent += tagMatch[1];
                patternMatched = true;
              }
              
              // If we found matches with this pattern, no need to try others
              if (patternMatched) {
                break;
              }
            }
            
            if (taggedContent) {
              includedContent = taggedContent;
            } else {
              console.warn(`Tag not found: ${tag} in ${resolvedPath}`);
            }
          }
        }
        
        // Replace the include directive with the included content
        result = result.replace(fullMatch, includedContent);
      } else {
        console.warn(`Include file not found: ${resolvedPath}`);
        result = result.replace(fullMatch, `// Include file not found: ${includePath}`);
      }
    } catch (error) {
      console.error(`Error processing include ${includePath}:`, error);
      result = result.replace(fullMatch, `// Error processing include: ${includePath}`);
    }
  }
  
  return result;
}

/**
 * Process AsciiDoc content and convert directly to Markdown
 * @param content - The AsciiDoc content to process
 * @param baseDir - The base directory for resolving includes (defaults to config.docs.localPath)
 * @param customAttributes - Optional custom attributes to override the default ones
 * @returns The processed Markdown content
 */
export function processAsciiDoc(content: string, baseDir?: string, customAttributes?: Record<string, any>): string {
  try {
    // Set the base directory for includes
    const baseDirPath = baseDir || config.docs.localPath;
    
    // Prepare attributes with absolute paths to ensure correct resolution
    const attributes = {
      ...config.asciidoc.attributes,
      // Override root and articles with absolute paths to ensure correct resolution
      'root': process.cwd() + '/' + config.docs.localPath.slice(2),
      'articles': process.cwd() + '/' + config.docs.localPath.slice(2) + '/' + config.docs.articlesPath,
      // Apply custom attributes if provided
      ...(customAttributes || {})
    };
    
    // First process includes manually
    const contentWithIncludes = processIncludes(content, attributes, baseDirPath);


    // Then use asciidoctor to process conditionals and other directives
    const document = processor.load(contentWithIncludes, {
      // Set to false to prevent conversion to HTML
      to_file: false,
      // Enable include processor
      safe: 'unsafe',
      // Keep attributes for downdoc processing
      standalone: true,
      // Set base directory for includes
      base_dir: baseDirPath,
      // Set attributes - explicitly set flow and react
      attributes: {
        ...attributes,
        // Ensure flow and react are explicitly set as strings
        'flow': (attributes as any)['flow'] ? 'true' : undefined,
        'react': (attributes as any)['react'] ? 'true' : undefined
      }
    });
    
    // Get the processed AsciiDoc content
    const processedAsciiDoc = document.getSource();
    

    // Use downdoc JS API to convert the processed AsciiDoc to Markdown
    const markdown = downdoc(processedAsciiDoc, {
      attributes: {
        ...attributes,
        'markdown-list-indent': 2
      }
    });
    
    return markdown;
  } catch (error) {
    console.error('Error processing AsciiDoc:', error);
    // Return original content if processing fails
    return content;
  }
}
