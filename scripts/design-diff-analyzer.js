#!/usr/bin/env node
/**
 * Design Diff Analyzer
 * Analyzes changes to ui-design.pen and generates implementation tasks for Claude Code
 */

import { execSync } from 'child_process';
import fs from 'fs';

function getDiff() {
  try {
    return execSync('git diff HEAD~1 ui-design.pen', { encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

function analyzeDiff(diff) {
  const changes = {
    colors: [],
    typography: [],
    spacing: [],
    layout: [],
    content: []
  };

  const lines = diff.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Color changes
    if (line.includes('"fill":') || line.includes('"backgroundColor":')) {
      const oldMatch = lines[i-1]?.match(/"(fill|backgroundColor)":\s*"([^"]+)"/);
      const newMatch = line.match(/"(fill|backgroundColor)":\s*"([^"]+)"/);
      
      if (oldMatch && newMatch && oldMatch[2] !== newMatch[2]) {
        changes.colors.push({
          type: oldMatch[1],
          from: oldMatch[2],
          to: newMatch[2]
        });
      }
    }
    
    // Font size changes
    if (line.includes('"fontSize":')) {
      const oldMatch = lines[i-1]?.match(/"fontSize":\s*(\d+)/);
      const newMatch = line.match(/"fontSize":\s*(\d+)/);
      
      if (oldMatch && newMatch && oldMatch[1] !== newMatch[1]) {
        changes.typography.push({
          type: 'fontSize',
          from: parseInt(oldMatch[1]),
          to: parseInt(newMatch[1])
        });
      }
    }
    
    // Spacing/padding changes
    if (line.includes('"padding":') || line.includes('"margin":') || line.includes('"gap":')) {
      const oldMatch = lines[i-1]?.match(/"(padding|margin|gap)":\s*(\d+)/);
      const newMatch = line.match(/"(padding|margin|gap)":\s*(\d+)/);
      
      if (oldMatch && newMatch && oldMatch[2] !== newMatch[2]) {
        changes.spacing.push({
          type: oldMatch[1],
          from: parseInt(oldMatch[2]),
          to: parseInt(newMatch[2])
        });
      }
    }
    
    // Content changes (text only - no implementation needed)
    if (line.includes('"content":')) {
      const oldMatch = lines[i-1]?.match(/"content":\s*"([^"]+)"/);
      const newMatch = line.match(/"content":\s*"([^"]+)"/);
      
      if (oldMatch && newMatch && oldMatch[1] !== newMatch[1]) {
        changes.content.push({
          from: oldMatch[1],
          to: newMatch[1]
        });
      }
    }
  }
  
  return changes;
}

function analyzeIntent(changes) {
  const intent = {
    patterns: [],
    systems: [],
    recommendations: []
  };
  
  // Detect color-coding system for types
  const accentColorIntro = changes.colors.filter(c => 
    c.to.includes('accent-') && !c.from.includes('accent-')
  );
  
  if (accentColorIntro.length >= 4) {
    const colors = [...new Set(accentColorIntro.map(c => c.to))];
    intent.systems.push({
      type: 'color-coding',
      description: 'Type-based color system',
      colors: colors,
      explanation: 'Each entity type (Project, Procedure, Person, Topic) has its own accent color. This color should be used consistently for: icons, active states, badges, and any UI element representing that type.',
      critical: '⚠️ IMPORTANT: Active states must use the color **dynamically** based on the note type, not hardcoded. Example: if a Project is selected, use accent-red; if a Procedure is selected, use accent-purple.'
    });
  }
  
  // Detect contrast improvements
  const contrastChanges = changes.colors.filter(c =>
    c.from === '$--muted-foreground' && c.to === '$--foreground'
  );
  
  if (contrastChanges.length > 3) {
    intent.patterns.push({
      type: 'contrast-improvement',
      description: 'Increased text contrast for better readability',
      count: contrastChanges.length
    });
  }
  
  // Detect spacing improvements
  if (changes.spacing.length > 0) {
    const avgIncrease = changes.spacing.reduce((sum, s) => sum + (s.to - s.from), 0) / changes.spacing.length;
    if (avgIncrease > 0) {
      intent.patterns.push({
        type: 'spacing-increase',
        description: 'Increased spacing for less cluttered UI',
        avgIncrease: Math.round(avgIncrease)
      });
    }
  }
  
  return intent;
}

function generateTasks(changes, intent) {
  const tasks = [];
  
  // Color changes → update theme.json or CSS variables
  if (changes.colors.length > 0) {
    const colorList = changes.colors.map(c => 
      `  - ${c.type}: ${c.from} → ${c.to}`
    ).join('\n');
    
    let details = `Color changes detected:\n${colorList}\n\nUpdate src/theme.json or CSS variables to match the design.`;
    
    // Add intent explanation if color-coding system detected
    const colorSystem = intent.systems.find(s => s.type === 'color-coding');
    if (colorSystem) {
      details += `\n\n${colorSystem.explanation}\n\n${colorSystem.critical}`;
    }
    
    tasks.push({
      priority: 'high',
      description: 'Update color palette',
      details: details
    });
  }
  
  // Typography changes → update theme.json
  if (changes.typography.length > 0) {
    const typoList = changes.typography.map(t =>
      `  - ${t.type}: ${t.from}px → ${t.to}px`
    ).join('\n');
    
    tasks.push({
      priority: 'medium',
      description: 'Update typography',
      details: `Typography changes detected:\n${typoList}\n\nUpdate src/theme.json typography settings.`
    });
  }
  
  // Spacing changes → update theme.json
  if (changes.spacing.length > 0) {
    const spacingList = changes.spacing.map(s =>
      `  - ${s.type}: ${s.from}px → ${s.to}px`
    ).join('\n');
    
    tasks.push({
      priority: 'medium',
      description: 'Update spacing',
      details: `Spacing changes detected:\n${spacingList}\n\nUpdate src/theme.json spacing values.`
    });
  }
  
  return tasks;
}

function formatOutput(tasks, changes, intent) {
  if (tasks.length === 0 && changes.content.length === 0) {
    return null;
  }
  
  let output = '🎨 Design changes detected:\n\n';
  
  // Add design intent analysis
  if (intent.systems.length > 0 || intent.patterns.length > 0) {
    output += '🧠 Design Intent Analysis:\n\n';
    
    intent.systems.forEach(system => {
      output += `📐 ${system.description}\n`;
      output += `${system.explanation}\n`;
      if (system.critical) {
        output += `\n${system.critical}\n`;
      }
      output += '\n';
    });
    
    intent.patterns.forEach(pattern => {
      output += `• ${pattern.description}`;
      if (pattern.count) output += ` (${pattern.count} changes)`;
      if (pattern.avgIncrease) output += ` (+${pattern.avgIncrease}px avg)`;
      output += '\n';
    });
    output += '\n';
  }
  
  if (tasks.length > 0) {
    output += '📋 Implementation tasks:\n\n';
    tasks.forEach((task, i) => {
      output += `${i + 1}. [${task.priority.toUpperCase()}] ${task.description}\n`;
      output += `${task.details}\n\n`;
    });
  }
  
  if (changes.content.length > 0) {
    output += '📝 Content changes (mockup text only, no code changes needed):\n';
    changes.content.forEach(c => {
      output += `  - "${c.from}" → "${c.to}"\n`;
    });
    output += '\n';
  }
  
  return { output, tasks, intent };
}

function main() {
  const diff = getDiff();
  
  if (!diff) {
    console.log('No design changes detected');
    process.exit(0);
  }
  
  const changes = analyzeDiff(diff);
  const intent = analyzeIntent(changes);
  const tasks = generateTasks(changes, intent);
  const result = formatOutput(tasks, changes, intent);
  
  if (!result) {
    console.log('No significant design changes detected');
    process.exit(0);
  }
  
  console.log(result.output);
  
  // Output JSON for automation
  if (process.argv.includes('--json')) {
    console.log('\n---JSON---');
    console.log(JSON.stringify({ tasks, changes, intent }, null, 2));
  }
  
  process.exit(tasks.length > 0 ? 1 : 0); // Exit 1 if there are tasks to implement
}

main();
