<div align="center">
  <img width="92" height="157" src="public/logo.png">
  <h1>CILAS<br/> Cairo Institute of Liberal Arts and Sciences</h1>
  <br>
</div>

## Motivation

During my one-year enrollment in the Bridge Programme at CILAS, I experienced a transformative learning environment that emphasized discussion-based learning, creative inquiry, self-reflection, and civic engagement. This was a stark contrast to the traditional, exam-focused education I was used to.

The ethos of CILAS—to create an inclusive space where people from diverse socio-economic backgrounds can engage in meaningful education—resonated deeply with me. As I transition into a career as a web developer, I am eager to contribute to CILAS and enable its students to share their ideas and engage with such a complex world.

## To-Do

### **Dashboard**

- [ ] **Course Management**:

  - [x] Add course.
    - [x] Setup tiptap for the course content.
    - [x] Add course metadata fields.
    - [x] Add zod validation to the form.
    - [x] Add draft option when adding a course.
    - [x] Attach to database
  - [x] Update, and delete courses.
  - [x] Add filter option for courses page: all/ongoing/archived/starting soon.
  - [ ] Add courses sets feature.
  - [ ] Add students to courses feature.

- [ ] **Blog Management**:
- [ ] **Event Management**:
- [ ] **User Management**:
- [ ] **Multilingual Support**:

## Setup

### Create .env file with your values

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000

#  set to false in localhost
NODE_ENV=development

NEON_DATABASE_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Run the server:

```
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
