/**
 * 115-1 English Table 主題與題目（依場次日期）。
 * 來源：115-1 English Table Topics。週二、週三的圖表在活動現場使用，此處只保留主題與文字題目。
 */

const SESSIONS = {
  '2026-09-21': {
    week: 3,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Cafés & Study Spaces',
    questions: [
      'Please tell me about a café or place where you like to study.',
      'Why do you like studying there? Please explain.',
      'Your friend Ethan wants to find a good place to study for an exam. What place would you recommend, and why?',
      'Have you ever studied with your friends outside the classroom? What did you do together?',
      'You want to study at a café this weekend. Invite your classmate Lily to join you.',
      'Lily says cafés are usually too noisy. Talk with her about how you can find a place where both of you can study comfortably.',
    ],
  },
  '2026-09-28': {
    week: 4,
    weekday: 'Monday',
    format: 'holiday',
    topic: 'National Holiday',
    questions: [],
  },
  '2026-10-05': {
    week: 5,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Online Shopping',
    questions: [
      'Please tell me about something you bought online recently.',
      'Why did you choose to buy it online? Please explain.',
      'Your friend Mason wants to buy a backpack online. What advice would you give him, and why?',
      'Have you ever received something different from what you expected? What happened?',
      'You found a good online sale. Invite your classmate Chloe to shop with you.',
      'Chloe is worried about buying the wrong product. Talk with her about how you can shop safely together.',
    ],
  },
  '2026-10-12': {
    week: 6,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Exercise & Fitness',
    questions: [
      'Please tell me about a sport or exercise you enjoy.',
      'Why do you like this activity? Please explain.',
      'Your friend Leo wants to become healthier. What activity would you recommend, and why?',
      'Have you ever exercised with your friends? What did you do together?',
      'You want to join a fitness class. Invite your classmate Ava to join you.',
      'Ava says she has never exercised before. Talk with her about how both of you can start together.',
    ],
  },
  '2026-11-02': {
    week: 9,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Pets & Animals',
    questions: [
      'Please tell me about your favorite animal or pet.',
      'Why do you like this animal? Please explain.',
      'Your friend Emma wants to keep a pet for the first time. What pet would you recommend, and why?',
      'Have you ever taken care of a pet? What did you do?',
      'You want to visit an animal café this weekend. Invite your classmate Noah to join you.',
      'Noah is allergic to some animals. Talk with him about how both of you can still enjoy the visit.',
    ],
  },
  '2026-11-09': {
    week: 10,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Festivals & Celebrations',
    questions: [
      'Please tell me about your favorite festival or holiday.',
      'Why do you enjoy it? Please explain.',
      'Your exchange student friend Mia wants to experience a Taiwanese festival. Which one would you recommend, and why?',
      'Have you ever celebrated a special day with your friends? What did you do?',
      'You are planning a Mid-Autumn Festival barbecue. Invite your classmate Ben to join you.',
      'Ben already has another plan. Talk with him about how you can celebrate together another time.',
    ],
  },
  '2026-11-16': {
    week: 11,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Cooking & Favorite Dishes',
    questions: [
      'Please tell me about a dish you can cook.',
      'Why do you enjoy cooking it? Please explain.',
      'Your friend Ethan wants to learn how to cook. What dish would you recommend, and why?',
      'Have you ever cooked with your family or friends? What did you make together?',
      'You want to cook dinner this weekend. Invite your classmate Sophie to join you.',
      'Sophie says she cannot cook very well. Talk with her about how both of you can prepare the meal together.',
    ],
  },
  '2026-11-23': {
    week: 12,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Part-time Jobs',
    questions: [
      'Please tell me about a part-time job you have had or would like to have.',
      'Why are you interested in this job? Please explain.',
      'Your friend Lucas wants to find a part-time job. What advice would you give him, and why?',
      'Have you ever learned a useful skill from work or volunteer experience? What was it?',
      'You found a part-time job opening. Invite your classmate Hannah to apply with you.',
      'Hannah is worried she does not have enough experience. Talk with her about how both of you can prepare for the interview.',
    ],
  },
  '2026-11-30': {
    week: 13,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'Travel Planning',
    questions: [
      'Please tell me about a place you would like to visit.',
      'Why do you want to go there? Please explain.',
      'Your friend Daniel is planning a short vacation. Where would you recommend, and why?',
      'Have you ever traveled with your friends? What did you do together?',
      'You are planning a weekend trip. Invite your classmate Ella to go with you.',
      'Ella has a limited budget. Talk with her about how both of you can plan an affordable trip.',
    ],
  },
  '2026-12-07': {
    week: 14,
    weekday: 'Monday',
    format: 'conversation',
    topic: 'AI in Everyday Life',
    questions: [
      'Please tell me about an AI tool or app you have used.',
      'Why do you use it? Please explain.',
      'Your friend Ryan wants to use AI to help with his studies. What advice would you give him, and why?',
      'Have you ever used AI to complete a school assignment? How did it help you?',
      'You want to try a new AI tool for learning English. Invite your classmate Grace to use it with you.',
      'Grace worries that students may depend too much on AI. Talk with her about how both of you can use AI responsibly.',
    ],
  },
  '2026-09-22': {
    week: 3,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Study Locations',
    questions: [
      'Based on the chart, which study location is the most popular among university students? What might explain the difference between the most and least popular choices?',
      'Which study location works best for you? What features of this place help or prevent you from studying effectively?',
      'If you could redesign one study space on campus, which space would you choose? What two improvements would you make, and how would they benefit students?',
    ],
  },
  '2026-09-29': {
    week: 4,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Sleeping Habits',
    questions: [
      'Looking at the chart, what does it suggest about university students’ sleeping habits? Which result do you find most concerning, and why?',
      'How does the amount of sleep you get affect your concentration, mood, or academic performance?',
      'If your university wanted to help students develop healthier sleep habits, what program or policy should it introduce? Explain how your idea would work.',
    ],
  },
  '2026-10-06': {
    week: 5,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'AI Tools',
    questions: [
      'According to the chart, which AI tool is used most frequently by students? What factors might explain why some tools are more popular than others?',
      'Which learning tasks can AI perform effectively, and which tasks should students still complete by themselves? Give examples from your experience.',
      'If you were asked to create guidelines for using AI in university courses, what would be the most important rule? Explain why students and teachers would benefit from it.',
    ],
  },
  '2026-10-13': {
    week: 6,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Food Delivery',
    questions: [
      'What does the chart suggest about university students’ use of food-delivery services? What might explain the difference between frequent and infrequent users?',
      'When deciding whether to cook, eat out, or order food, what factors are most important to you? Explain how they influence your decision.',
      'Imagine that students want meals that are convenient, affordable, and healthy. What service or change should the university introduce to meet these needs?',
    ],
  },
  '2026-11-03': {
    week: 9,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Student Spending',
    questions: [
      'Based on the chart, which category accounts for the largest share of student spending? What factors might explain the differences among the categories?',
      'Which of your regular expenses are necessary, and which could you reduce? Explain how changing your spending habits might affect your daily life.',
      'If you could design a short financial-management workshop for university students, what two topics should it cover? Explain why these topics are important.',
    ],
  },
  '2026-11-10': {
    week: 10,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Types of Exercise',
    questions: [
      'According to the chart, which type of exercise is the most popular? What might make it more attractive than the other options?',
      'What factors influence your decision to exercise or not to exercise, such as time, cost, location, or motivation?',
      'If your university wanted to increase student participation in physical activity, what new class or program should it provide? Explain how it would encourage students to exercise?',
    ],
  },
  '2026-11-17': {
    week: 11,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Travel to Campus',
    questions: [
      'Looking at the chart, what does it reveal about how students travel to campus? What might explain why some forms of transportation are much more common than others?',
      'What are the main advantages and disadvantages of the way you usually travel to university?',
      'If the university wanted students to use safer and more environmentally friendly transportation, what change should it make first? Explain why your proposal would be effective.',
    ],
  },
  '2026-11-24': {
    week: 12,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Leisure Activities',
    questions: [
      'Based on the chart, which leisure activity is the most popular? What might the results suggest about how university students spend their free time?',
      'How does your preferred leisure activity affect your physical health, mental well-being, or relationships with other people?',
      'If you could organize a new campus activity to help students use their free time more meaningfully, what activity would you create? Explain how it would benefit students.',
    ],
  },
  '2026-12-01': {
    week: 13,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Reasons for Learning English',
    questions: [
      'According to the chart, what is the most common reason students learn English? Why might this reason be more important to them than the other reasons?',
      'Which reason for learning English is most important to you? How has this goal influenced the way you study English?',
      'If the university could invest in only one new program to improve students’ practical English ability, what program should it create? Explain how the program would help students.',
    ],
  },
  '2026-12-08': {
    week: 14,
    weekday: 'Tuesday',
    format: 'chart',
    topic: 'Skills Before Graduation',
    questions: [
      'Looking at the chart, which skill do most students want to improve before graduation? Why do you think this skill ranks first?',
      'Which skill would you most like to improve before graduation? Why is it important for your future studies or career?',
      'If you could design a new university course to help students prepare for their future careers, what course would you create? What would students learn in the course?',
    ],
  },
  '2026-09-23': {
    week: 3,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Digital Note-Taking vs. Handwritten Notes',
    passageTitle: 'Laptops Are Replacing Handwritten Notes',
    passage: 'Some people believe that taking notes by hand is becoming outdated at university. They argue that laptops allow students to type faster, organize information more easily, and quickly search their notes later. Digital notes can also include links, images, and other useful materials. Supporters therefore claim that most university students now prefer using laptops in class and that handwritten notes will gradually disappear from university classrooms.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-09-30': {
    week: 4,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Smartphones and Studying',
    passageTitle: 'Smartphones Make It Almost Impossible to Focus',
    passage: 'Some people believe that smartphones are one of the biggest distractions for university students. Messages, social media, and short videos can easily interrupt studying and make it difficult to concentrate for long periods. They argue that most students check their phones repeatedly while studying, even when there is no important message. From this perspective, students who want to study effectively should keep their phones away until they finish their work.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-10-07': {
    week: 5,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Playback Speed',
    passageTitle: 'Students Should Watch Learning Videos at Normal Speed',
    passage: 'Some educators believe that students should watch learning videos at normal speed. They argue that increasing the playback speed gives students less time to understand explanations, connect ideas, and take useful notes. Watching videos faster may save time, but students could miss important details or remember less afterward. For these reasons, they believe that most university students choose normal speed when watching videos for serious academic learning.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-10-14': {
    week: 6,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Class Participation',
    passageTitle: 'Speaking in Class Is the Best Way to Participate',
    passage: 'Some instructors believe that speaking in front of the whole class is the most valuable form of classroom participation. They argue that answering questions and sharing opinions publicly help students develop confidence and communication skills. Students also learn to organize their ideas quickly when responding to others. From this perspective, most university students should prefer speaking directly in class rather than participating through small-group discussions or online activities.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-11-04': {
    week: 9,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Group Study vs. Studying Alone',
    passageTitle: 'Studying in Groups Is the Best Way to Prepare for Exams',
    passage: 'Some students believe that studying with classmates is more effective than studying alone. Group members can explain difficult ideas, share notes, and help each other notice important information they may have missed. Supporters also argue that discussing course material makes studying more interesting and keeps students motivated. For these reasons, they claim that most university students prefer preparing for important exams with other people rather than studying by themselves.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-11-11': {
    week: 10,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Printed vs. Digital Learning Materials',
    passageTitle: 'Printed Textbooks Are Still Essential for University Students',
    passage: 'Although digital materials are widely available, some people believe printed textbooks remain an essential part of university learning. They argue that reading from paper helps students concentrate, take notes, and remember information more effectively. Printed books also allow students to study without being distracted by messages or other online content. Supporters therefore believe that most university students still regularly buy printed textbooks for their courses despite the growing availability of digital alternatives.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-11-18': {
    week: 11,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Instructor Feedback vs. AI Feedback',
    passageTitle: 'AI Feedback Is Becoming More Useful Than Instructor Feedback',
    passage: 'Some people believe that AI tools are becoming a better source of feedback for university students. AI can respond immediately, identify language problems, and suggest ways to improve an assignment at any time. Students can also ask for feedback repeatedly without waiting for an instructor. Supporters therefore argue that most students now find AI feedback more useful and convenient than feedback from their instructors.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-11-25': {
    week: 12,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Class Attendance',
    passageTitle: 'Optional Attendance Leads Students to Skip Class',
    passage: 'Some people believe that university students are unlikely to attend class regularly if attendance is not required. They argue that without attendance grades or penalties, students may choose to sleep longer, study independently, or spend time on other activities. Supporters therefore believe that attendance rules are necessary to keep students engaged in their courses. Without such rules, they claim that most students would attend class only occasionally.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-12-02': {
    week: 13,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Assignment Deadlines',
    passageTitle: 'Starting Assignments Early Leads to Better Work',
    passage: 'Some instructors believe that university students should begin major assignments as early as possible. Starting early gives students more time to organize their ideas, find useful information, and revise their work carefully. It can also reduce the stress caused by rushing to finish everything before a deadline. For these reasons, they believe that most university students recognize these benefits and prefer to complete major assignments gradually rather than doing most of the work at the last minute.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-12-09': {
    week: 14,
    weekday: 'Wednesday',
    format: 'passage',
    topic: 'Choosing a First Job',
    passageTitle: 'Salary Is the Top Priority When Students Choose Their First Job',
    passage: 'Some people believe that salary is the most important factor for university graduates choosing their first full-time job. Young workers may need to pay rent, manage daily expenses, or begin saving for the future. A higher salary can therefore provide greater financial security and independence. For these reasons, supporters argue that most university students would choose a well-paid job over one offering better work-life balance or opportunities for career growth.',
    questions: [
      'Discuss the key difference between the passage and the chart.',
      'Explain whether you agree or disagree with the passage. You may draw examples from your own experience.',
    ],
  },
  '2026-09-24': {
    week: 3,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Health and Well-being',
    lead: 'Discuss healthy habits, challenges, and ways to promote a healthier campus.',
    questions: [
      'What do you usually do to stay healthy?',
      'Which healthy habit is the hardest for you to keep? Why?',
      'Do you think university students have a healthy lifestyle? Why or why not?',
      'What makes it difficult for students to stay healthy at university?',
      'What is one thing students can do to live a healthier life?',
      'If you could change one thing on campus to help students live healthier lives, what would you change? Explain your idea.',
    ],
  },
  '2026-10-01': {
    week: 4,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Mental Health and Stress',
    lead: 'Discuss stress, mental health, and ways to maintain emotional well-being.',
    questions: [
      'What usually makes you feel stressed?',
      'What do you usually do to relax when you feel stressed?',
      'Do you think university students are under too much stress? Why or why not?',
      'What are the biggest sources of stress for university students?',
      'What can students do to take better care of their mental health?',
      'If you could start one new activity at your university to reduce students’ stress, what would it be? Explain your idea.',
    ],
  },
  '2026-10-08': {
    week: 5,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Responsible Food Choices',
    lead: 'Discuss eating habits and how students can make more sustainable food choices.',
    questions: [
      'How often do you eat out each week?',
      'What kind of food do you usually choose? Why?',
      'Do you think university students make healthy food choices? Why or why not?',
      'What makes it difficult to eat healthy or avoid wasting food?',
      'What can students do to make more responsible food choices?',
      'If you could create one new food service on campus, what would it be? Explain your idea.',
    ],
  },
  '2026-10-15': {
    week: 6,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Responsible Consumption',
    lead: 'Discuss shopping habits and how to become more responsible consumers.',
    questions: [
      'What do you usually spend your money on?',
      'Before buying something, what do you usually consider?',
      'Do you think people buy too many things they do not really need? Why or why not?',
      'Why do people sometimes buy things they never use?',
      'What can people do to become more responsible shoppers?',
      'If you wanted to encourage students to buy less and waste less, what would you do?',
    ],
  },
  '2026-11-05': {
    week: 9,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Plastic-Free Campus',
    lead: 'Discuss plastic use and explore ways to reduce plastic waste on campus.',
    questions: [
      'Do you usually bring your own water bottle or shopping bag?',
      'What kinds of plastic do you use every day?',
      'Do you think it is easy to reduce plastic waste? Why or why not?',
      'What makes it difficult for people to use less plastic?',
      'What can students do to reduce plastic waste at university?',
      'If your university wanted to become a plastic-free campus, what changes would you suggest?',
    ],
  },
  '2026-11-12': {
    week: 10,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Green Transportation',
    lead: 'Discuss transportation choices and ways to reduce carbon emissions.',
    questions: [
      'How do you usually travel to school?',
      'Why do you choose this way of transportation?',
      'Do you think more people should use public transportation or ride bicycles? Why or why not?',
      'What makes it difficult for people to choose environmentally friendly transportation?',
      'What can students do to reduce pollution when they travel?',
      'If you could improve transportation around your university, what would you change?',
    ],
  },
  '2026-11-19': {
    week: 11,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'AI and Smart Learning',
    lead: 'Discuss how AI is changing learning and how students can use it responsibly.',
    questions: [
      'Do you use AI tools for your studies?',
      'How do AI tools help you learn?',
      'Do you think AI makes learning better? Why or why not?',
      'What are some possible problems with using AI for schoolwork?',
      'How can students use AI responsibly?',
      'If you were a teacher, how would you encourage students to use AI in a responsible way?',
    ],
  },
  '2026-11-26': {
    week: 12,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Digital Well-being',
    lead: 'Discuss technology habits and how to maintain a healthy digital life.',
    questions: [
      'How many hours do you spend on your phone every day?',
      'What do you usually do on your phone?',
      'Do you think people spend too much time online? Why or why not?',
      'How can spending too much time online affect our lives?',
      'What can people do to develop healthier digital habits?',
      'If you had one “No Phone Day” each month, how would you spend your time instead?',
    ],
  },
  '2026-12-03': {
    week: 13,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Community Engagement',
    lead: 'Discuss volunteering and ways to make a positive impact on the community.',
    questions: [
      'Have you ever done volunteer work?',
      'What kind of volunteer work would you like to try?',
      'Do you think university students should do volunteer work? Why or why not?',
      'What are some reasons people choose not to volunteer?',
      'How can universities encourage more students to help their communities?',
      'If you could organize one volunteer project, what would it be? Explain your idea.',
    ],
  },
  '2026-12-10': {
    week: 14,
    weekday: 'Thursday',
    format: 'discussion',
    topic: 'Building a Better Campus',
    lead: 'Discuss ideas for creating a more sustainable, inclusive, and enjoyable university campus.',
    questions: [
      'What do you like most about your university?',
      'What is one thing you would like to improve on campus?',
      'Do you think universities should do more to become sustainable? Why or why not?',
      'What challenges do universities face when trying to improve campus life?',
      'What can students do to make their campus a better place?',
      'If you were the president of your university for one day, what would be your first change? Explain your idea.',
    ],
  },
};

export const ENGLISH_TABLE_TOPIC_SEMESTER = '115-1';

export function normalizeEnglishTableTopicDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  }
  return '';
}

export function getEnglishTableTopic(dateInput) {
  const key = normalizeEnglishTableTopicDate(dateInput);
  if (!key) return null;
  return SESSIONS[key] || null;
}

export function listEnglishTableTopicDates() {
  return Object.keys(SESSIONS);
}

export function listEnglishTableTopics() {
  return Object.entries(SESSIONS)
    .map(([date, session]) => ({ date, ...session }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
