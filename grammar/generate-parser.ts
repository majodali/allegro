import { readFileSync, writeFileSync } from 'fs';
import { parseGrammarBootstrapped, generateStandaloneParser } from 'parser-generator';
import path from 'node:path'

const grammar_dir = path.dirname(import.meta.url.replace(/^file:\/*/, ''))
const project_dir = path.dirname(grammar_dir)

const grammarSrc = readFileSync(path.join(grammar_dir, 'allegro.grammar'), 'utf-8');
parseGrammarBootstrapped(grammarSrc).then(grammar => {
	const parserCode = generateStandaloneParser(grammar);
	writeFileSync(path.join(project_dir, 'src', 'parser.ts'), parserCode);

	console.log('Generated allegro-parser.ts');
});
