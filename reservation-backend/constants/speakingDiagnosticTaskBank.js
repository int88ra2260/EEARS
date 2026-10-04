'use strict';

const READ_ALOUD_TASKS = [
  {
    "taskKey": "ra-a2-campus-library",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Campus Library",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "The university library is quiet, and many students study there after class.",
    "estimatedSeconds": 12,
    "targetWords": 12,
    "focusTags": [
      "campus",
      "word_completion",
      "sentence_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-club-meeting",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Club Meeting",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Our English club meets every Wednesday afternoon in the student center.",
    "estimatedSeconds": 11,
    "targetWords": 11,
    "focusTags": [
      "campus",
      "rhythm",
      "final_consonants"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-morning-class",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Morning Class",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "I usually arrive early because my first class starts at eight thirty.",
    "estimatedSeconds": 11,
    "targetWords": 12,
    "focusTags": [
      "daily_routine",
      "word_stress",
      "final_consonants"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-cafeteria-lunch",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Cafeteria Lunch",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "The cafeteria is crowded at noon, but the food is cheap and warm.",
    "estimatedSeconds": 12,
    "targetWords": 13,
    "focusTags": [
      "campus",
      "vowel_contrast",
      "pausing"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-bus-stop",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Bus Stop",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Many students wait at the bus stop near the main gate after school.",
    "estimatedSeconds": 12,
    "targetWords": 13,
    "focusTags": [
      "campus",
      "linking",
      "sentence_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-lab-partner",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Lab Partner",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "My lab partner explained the homework slowly, so I understood the answer.",
    "estimatedSeconds": 12,
    "targetWords": 12,
    "focusTags": [
      "classroom",
      "past_tense",
      "clarity"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-office-hours",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Office Hours",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "The teacher has office hours on Tuesday morning for students who need help.",
    "estimatedSeconds": 12,
    "targetWords": 13,
    "focusTags": [
      "campus",
      "function_words",
      "rhythm"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-sports-day",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Sports Day",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Our department team practiced every Friday before the sports day competition.",
    "estimatedSeconds": 11,
    "targetWords": 11,
    "focusTags": [
      "campus_life",
      "consonant_clusters",
      "word_completion"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-rainy-campus",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Rainy Campus",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "It rained heavily, so I shared my umbrella with a classmate.",
    "estimatedSeconds": 11,
    "targetWords": 11,
    "focusTags": [
      "daily_life",
      "past_tense",
      "intonation"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-study-plan",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Study Plan",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "I made a simple study plan before the midterm exam.",
    "estimatedSeconds": 10,
    "targetWords": 10,
    "focusTags": [
      "study_skills",
      "sentence_stress",
      "fluency"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-phone-message",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Phone Message",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Please leave a short message if I do not answer the phone.",
    "estimatedSeconds": 12,
    "targetWords": 12,
    "focusTags": [
      "daily_communication",
      "linking",
      "final_consonants"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-a2-weekend-review",
    "level": "A2",
    "taskType": "read_aloud",
    "title": "Weekend Review",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "On weekends, I review new words and listen to short English videos.",
    "estimatedSeconds": 12,
    "targetWords": 12,
    "focusTags": [
      "learning_strategy",
      "rhythm",
      "vocabulary"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "task_achievement"
    ]
  },
  {
    "taskKey": "ra-b1-group-project",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Group Project",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "When our group project became difficult, we divided the work and met twice a week.",
    "estimatedSeconds": 14,
    "targetWords": 15,
    "focusTags": [
      "past_tense",
      "consonant_clusters",
      "pausing"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-international-activity",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "International Activity",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Students can improve their confidence by joining international activities and speaking with visitors.",
    "estimatedSeconds": 14,
    "targetWords": 13,
    "focusTags": [
      "linking",
      "sentence_stress",
      "campus"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-presentation-practice",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Presentation Practice",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Before the presentation, our team practiced several times and changed the introduction.",
    "estimatedSeconds": 14,
    "targetWords": 12,
    "focusTags": [
      "academic_task",
      "past_tense",
      "word_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-service-learning",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Service Learning",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "The service learning activity helped me communicate with people from different backgrounds.",
    "estimatedSeconds": 14,
    "targetWords": 12,
    "focusTags": [
      "campus_life",
      "vocabulary",
      "rhythm"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-library-workshop",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Library Workshop",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "During the library workshop, students learned how to search for reliable academic sources.",
    "estimatedSeconds": 15,
    "targetWords": 13,
    "focusTags": [
      "academic_vocabulary",
      "sentence_stress",
      "linking"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-exchange-student",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Exchange Student",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "An exchange student joined our class and shared interesting stories about her university.",
    "estimatedSeconds": 14,
    "targetWords": 13,
    "focusTags": [
      "campus",
      "vowel_reduction",
      "intonation"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-part-time-job",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Part-time Job",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Although my part-time job is tiring, it teaches me responsibility and time management.",
    "estimatedSeconds": 15,
    "targetWords": 14,
    "focusTags": [
      "complex_clause",
      "academic_vocabulary",
      "pausing"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-online-meeting",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Online Meeting",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "If the online meeting connection is unstable, please turn off your camera first.",
    "estimatedSeconds": 14,
    "targetWords": 13,
    "focusTags": [
      "conditionals",
      "linking",
      "final_consonants"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-learning-feedback",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Learning Feedback",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "The instructor gave detailed feedback, so I knew which parts needed improvement.",
    "estimatedSeconds": 13,
    "targetWords": 12,
    "focusTags": [
      "feedback",
      "past_tense",
      "sentence_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-campus-map",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Campus Map",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Visitors often use the campus map because some buildings are difficult to find.",
    "estimatedSeconds": 13,
    "targetWords": 13,
    "focusTags": [
      "campus",
      "consonant_clusters",
      "clarity"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-team-discussion",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Team Discussion",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "In our team discussion, everyone suggested one solution and explained the reason.",
    "estimatedSeconds": 13,
    "targetWords": 12,
    "focusTags": [
      "discussion",
      "rhythm",
      "fluency"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b1-exam-preparation",
    "level": "B1",
    "taskType": "read_aloud",
    "title": "Exam Preparation",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "To prepare for the final exam, I reviewed notes and asked classmates questions.",
    "estimatedSeconds": 14,
    "targetWords": 13,
    "focusTags": [
      "study_skills",
      "infinitive_phrase",
      "pausing"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "grammar"
    ]
  },
  {
    "taskKey": "ra-b2-learning-environment",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Learning Environment",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "A supportive learning environment can increase motivation, especially when students receive specific feedback.",
    "estimatedSeconds": 16,
    "targetWords": 13,
    "focusTags": [
      "academic_vocabulary",
      "stress",
      "prosody"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-policy-discussion",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Policy Discussion",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Although online courses are convenient, face-to-face discussion often helps students develop stronger arguments.",
    "estimatedSeconds": 17,
    "targetWords": 15,
    "focusTags": [
      "complex_clause",
      "rhythm",
      "academic_discussion"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-critical-thinking",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Critical Thinking",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Critical thinking requires students to compare evidence, question assumptions, and explain their reasoning clearly.",
    "estimatedSeconds": 17,
    "targetWords": 14,
    "focusTags": [
      "academic_vocabulary",
      "parallel_structure",
      "sentence_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-community-engagement",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Community Engagement",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "University courses become more meaningful when students connect classroom knowledge with community engagement.",
    "estimatedSeconds": 16,
    "targetWords": 13,
    "focusTags": [
      "academic_vocabulary",
      "linking",
      "prosody"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-ai-learning",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "AI Learning",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Artificial intelligence tools may support language learning, but students still need clear goals and reflection.",
    "estimatedSeconds": 17,
    "targetWords": 15,
    "focusTags": [
      "technology",
      "contrastive_stress",
      "complex_clause"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-intercultural-communication",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Intercultural Communication",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Successful intercultural communication depends on curiosity, patience, and the ability to notice different expectations.",
    "estimatedSeconds": 18,
    "targetWords": 14,
    "focusTags": [
      "academic_vocabulary",
      "multisyllabic_words",
      "rhythm"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-research-project",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Research Project",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "A well-designed research project should include a focused question, appropriate data, and careful interpretation.",
    "estimatedSeconds": 18,
    "targetWords": 15,
    "focusTags": [
      "research",
      "academic_vocabulary",
      "pausing"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-sustainable-campus",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Sustainable Campus",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Creating a sustainable campus requires cooperation among students, teachers, administrators, and local communities.",
    "estimatedSeconds": 17,
    "targetWords": 13,
    "focusTags": [
      "sustainability",
      "word_stress",
      "listing_intonation"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-public-speaking",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Public Speaking",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Effective public speaking involves organizing ideas logically and adjusting language for the audience.",
    "estimatedSeconds": 16,
    "targetWords": 13,
    "focusTags": [
      "presentation",
      "academic_vocabulary",
      "prosody"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-digital-citizenship",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Digital Citizenship",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Digital citizenship means using online information responsibly while respecting privacy, accuracy, and diverse opinions.",
    "estimatedSeconds": 17,
    "targetWords": 14,
    "focusTags": [
      "technology",
      "academic_vocabulary",
      "rhythm"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-problem-solving",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Problem Solving",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "When students face complex problems, they should evaluate alternatives before choosing a practical solution.",
    "estimatedSeconds": 16,
    "targetWords": 14,
    "focusTags": [
      "problem_solving",
      "complex_clause",
      "sentence_stress"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  },
  {
    "taskKey": "ra-b2-global-issues",
    "level": "B2",
    "taskType": "read_aloud",
    "title": "Global Issues",
    "prompt": "Read the sentence aloud clearly.",
    "targetText": "Discussing global issues can help students understand how local choices influence wider social changes.",
    "estimatedSeconds": 16,
    "targetWords": 14,
    "focusTags": [
      "global_issues",
      "academic_discussion",
      "intonation"
    ],
    "constructTags": [
      "fluency",
      "pronunciation_intelligibility",
      "vocabulary"
    ]
  }
];

const CONSTRUCTED_RESPONSE_TASKS = [
  {
    "taskKey": "pd-a2-campus-cafe",
    "level": "A2",
    "taskType": "picture_description",
    "title": "Campus Cafe Scene",
    "prompt": "Imagine a campus cafe scene: three students are sitting at a table, one student is ordering a drink, and a backpack is on a chair. Describe what you can see in 30 seconds.",
    "targetText": "Describe people, place, visible actions, and simple details in the campus cafe scene.",
    "estimatedSeconds": 30,
    "targetWords": 35,
    "focusTags": [
      "picture_description",
      "campus",
      "present_continuous"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement"
    ]
  },
  {
    "taskKey": "sa-a2-library-help",
    "level": "A2",
    "taskType": "campus_short_answer",
    "title": "Library Help",
    "prompt": "A new classmate asks where to find an English book in the library. What would you say?",
    "targetText": "Give a short helpful answer with location or action words.",
    "estimatedSeconds": 25,
    "targetWords": 25,
    "focusTags": [
      "campus_life",
      "directions",
      "helping"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement"
    ]
  },
  {
    "taskKey": "op-a2-best-study-time",
    "level": "A2",
    "taskType": "opinion_response",
    "title": "Best Study Time",
    "prompt": "Do you prefer studying in the morning or at night? Give one reason.",
    "targetText": "State a preference and give one simple reason.",
    "estimatedSeconds": 30,
    "targetWords": 30,
    "focusTags": [
      "opinion",
      "daily_routine",
      "because"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "pd-a2-rainy-campus",
    "level": "A2",
    "taskType": "picture_description",
    "title": "Rainy Campus Scene",
    "prompt": "Imagine students walking across campus on a rainy day. Some have umbrellas and one student is waiting at a bus stop. Describe the scene.",
    "targetText": "Describe weather, people, objects, and simple actions in the rainy campus scene.",
    "estimatedSeconds": 30,
    "targetWords": 35,
    "focusTags": [
      "picture_description",
      "weather",
      "campus"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement"
    ]
  },
  {
    "taskKey": "pd-b1-group-project-room",
    "level": "B1",
    "taskType": "picture_description",
    "title": "Group Project Room",
    "prompt": "Imagine four students working on a group project in a study room. One student is pointing at a laptop, and others are taking notes. Describe the situation and what might happen next.",
    "targetText": "Describe the scene and add a likely next action or reason.",
    "estimatedSeconds": 45,
    "targetWords": 55,
    "focusTags": [
      "picture_description",
      "group_project",
      "prediction"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "sa-b1-missed-deadline",
    "level": "B1",
    "taskType": "campus_short_answer",
    "title": "Missed Deadline",
    "prompt": "You missed a homework deadline because of a team meeting. Explain the situation to your teacher and ask what you can do.",
    "targetText": "Explain the problem politely and make a clear request.",
    "estimatedSeconds": 45,
    "targetWords": 50,
    "focusTags": [
      "campus_life",
      "polite_request",
      "past_tense"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "op-b1-online-learning",
    "level": "B1",
    "taskType": "opinion_response",
    "title": "Online Learning",
    "prompt": "Some students prefer online English practice, while others prefer face-to-face classes. Which do you prefer and why?",
    "targetText": "State a preference, compare two options, and give at least one reason.",
    "estimatedSeconds": 45,
    "targetWords": 55,
    "focusTags": [
      "opinion",
      "comparison",
      "learning_strategy"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "sa-b1-club-invitation",
    "level": "B1",
    "taskType": "campus_short_answer",
    "title": "Club Invitation",
    "prompt": "Invite an international student to join a campus club activity this weekend. Explain what the activity is and why it is interesting.",
    "targetText": "Invite someone, describe the activity, and give a reason.",
    "estimatedSeconds": 45,
    "targetWords": 50,
    "focusTags": [
      "campus_life",
      "invitation",
      "reasoning"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "pd-b2-sustainable-campus-poster",
    "level": "B2",
    "taskType": "picture_description",
    "title": "Sustainable Campus Poster",
    "prompt": "Imagine a poster showing a sustainable campus: students sort recycling, ride bikes, and discuss energy saving ideas. Describe the poster and explain its message.",
    "targetText": "Describe visible details and infer the main message of the sustainability poster.",
    "estimatedSeconds": 60,
    "targetWords": 75,
    "focusTags": [
      "picture_description",
      "sustainability",
      "inference"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "sa-b2-research-meeting",
    "level": "B2",
    "taskType": "campus_short_answer",
    "title": "Research Meeting",
    "prompt": "Your project group disagrees about how to collect data. Suggest a practical solution and explain why it would help.",
    "targetText": "Summarize the problem, propose a solution, and justify it.",
    "estimatedSeconds": 60,
    "targetWords": 75,
    "focusTags": [
      "academic_discussion",
      "problem_solving",
      "justification"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "op-b2-ai-language-learning",
    "level": "B2",
    "taskType": "opinion_response",
    "title": "AI for Language Learning",
    "prompt": "Should university students use AI tools to practice speaking English? Give your opinion with reasons and one possible limitation.",
    "targetText": "Present an opinion, develop reasons, and mention a limitation.",
    "estimatedSeconds": 60,
    "targetWords": 85,
    "focusTags": [
      "opinion",
      "technology",
      "balanced_argument"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  },
  {
    "taskKey": "op-b2-required-service-learning",
    "level": "B2",
    "taskType": "opinion_response",
    "title": "Required Service Learning",
    "prompt": "Some universities require students to complete service learning before graduation. Do you agree or disagree? Explain your view.",
    "targetText": "Take a position and develop a clear argument with supporting reasons.",
    "estimatedSeconds": 60,
    "targetWords": 85,
    "focusTags": [
      "opinion",
      "service_learning",
      "argument"
    ],
    "constructTags": [
      "fluency",
      "vocabulary",
      "grammar",
      "task_achievement",
      "coherence"
    ]
  }
];

const SPEAKING_TASKS = [...READ_ALOUD_TASKS, ...CONSTRUCTED_RESPONSE_TASKS];

module.exports = {
  READ_ALOUD_TASKS,
  CONSTRUCTED_RESPONSE_TASKS,
  SPEAKING_TASKS,
};
