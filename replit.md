# PodBoost - Podcast Growth Platform

## Overview
PodBoost is a multi-service SaaS platform designed to empower podcasters with comprehensive tools for growth and monetization. It offers a seamless experience across various functionalities including analytics, RSS feed validation, a growth engine, a sponsorship finder, and campaign management. The platform aims to provide all necessary tools for podcasters to manage, grow, and monetize their content effectively, with a premium subscription model to unlock advanced features.

## Recent Changes (Aug 2025)
- **DEPLOYMENT CRISIS RESOLVED:** Fixed critical 404 errors on live site https://podboost.com.au/
- **Complete Working Site:** Created self-contained HTML files that work without backend dependencies
- **Analytics Page:** Full CSV upload and analysis with charts, metrics, and recommendations
- **Growth Engine:** AI-powered growth analysis with CSV processing and detailed recommendations  
- **RSS Checker:** Feed validation, SEO scoring, and optimization suggestions
- **Client-Side Processing:** All features work directly in browser using JavaScript libraries
- **Production Ready:** All pages functional at podboost.com.au with proper navigation and branding

## User Preferences
- Language: English (everyday language, non-technical)
- Communication: Concise, professional, no emojis
- Platform access: Replit webview on ports 5000 and 8001

## System Architecture
The platform is built with a microservices-inspired architecture:
- **Main Platform (Node.js Express - Port 5000):** Handles core functionalities such as analytics, RSS checking, the growth engine, and the sponsorship finder.
- **Campaign Manager (Python Flask - Port 8001):** A dedicated application for creating and tracking sponsorship campaigns, utilizing a PostgreSQL database for data storage.
- **Frontend:** Developed using HTML, CSS, and JavaScript, with Tailwind CSS for modern and responsive styling.
- **UI/UX Decisions:** Features a professional aesthetic with a blue microphone logo. The design prioritizes mobile responsiveness, ensuring optimal viewing and interaction across various devices with proper viewport meta tags and responsive grid systems. It includes intuitive navigation, consistent headers, and well-structured forms.
- **Technical Implementations:** Includes AI-powered features for sponsor matching and growth analysis using OpenAI's GPT models. It incorporates robust authentication and subscription management via Stripe for premium feature access. The system handles CSV uploads for podcast data analysis and integrates with Netlify serverless functions for efficient and scalable operations. RSS parsing includes advanced features like trailer detection, SEO scoring, and comprehensive feed validation.

## External Dependencies
- **OpenAI API:** Utilized for AI-powered sponsorship matching and content analysis.
- **Stripe:** Integrated for handling premium subscriptions and payment processing.
- **PostgreSQL:** Used as the database for the Campaign Manager.
- **Tailwind CSS:** Employed for frontend styling and responsive design.
- **Netlify:** Used for deployment and serverless functions (e.g., RSS checker, sponsor finder, campaign management functions).
- **LinkedIn:** Integrated for contact verification and direct professional outreach to partnership managers.