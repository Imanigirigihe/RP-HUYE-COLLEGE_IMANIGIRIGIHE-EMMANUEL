-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 10, 2025 at 02:32 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `elearning_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `content`
--

CREATE TABLE `content` (
  `id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content_type` enum('Notes','Videos','Quizzes','Assignments') NOT NULL,
  `content_text` text DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `quiz_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quiz_data`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `content`
--

INSERT INTO `content` (`id`, `module_id`, `title`, `content_type`, `content_text`, `file_path`, `quiz_data`, `created_at`, `updated_at`) VALUES
(1, 2, 'BIG DATA', 'Videos', NULL, '/uploads/1749514917708-VID-20241006-WA0004.mp4', NULL, '2025-06-10 00:21:58', '2025-06-10 00:21:58'),
(2, 2, 'QUIZ OF BIG DATA', 'Quizzes', NULL, NULL, '[{\"question_text\":\"1. What are the key characteristics of Big Data, often referred to as the 3 Vs?  \\n\",\"options\":[\"a) Volume, Value, Variety         \",\"b) Volume, Variety, Velocity\",\"c) Volume, Validity, Verification\",\" d) Value, Velocity, Vision \"],\"correct_answer_index\":1}]', '2025-06-10 00:26:50', '2025-06-10 00:26:50');

-- --------------------------------------------------------

--
-- Table structure for table `enrollments`
--

CREATE TABLE `enrollments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `enrollment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_completed` tinyint(1) NOT NULL DEFAULT 0,
  `completed_date` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `enrollments`
--

INSERT INTO `enrollments` (`id`, `user_id`, `module_id`, `enrollment_date`, `is_completed`, `completed_date`) VALUES
(1, 3, 2, '2025-06-10 00:16:21', 0, NULL),
(2, 3, 1, '2025-06-10 00:16:38', 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `modules`
--

CREATE TABLE `modules` (
  `id` int(11) NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `instructor_id` int(11) NOT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `category` varchar(100) DEFAULT NULL,
  `difficulty` varchar(50) DEFAULT NULL,
  `duration_hours` int(11) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `modules`
--

INSERT INTO `modules` (`id`, `module_name`, `description`, `instructor_id`, `is_published`, `category`, `difficulty`, `duration_hours`, `price`, `created_at`, `updated_at`) VALUES
(1, 'big data', 'handling bigdata', 1, 1, 'A', 'Intermediate', 2, 0.00, '2025-06-09 23:43:42', '2025-06-09 23:43:42'),
(2, 'BI', 'BI', 4, 1, 'A', 'Beginner', 3, 0.00, '2025-06-10 00:14:38', '2025-06-10 00:14:38');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('learner','lecturer','admin') NOT NULL DEFAULT 'learner',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `firstname`, `lastname`, `email`, `password`, `role`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'HIRWA', 'Emmy', 'peter@gmail.com', '$2b$10$/RFY6DIvkZhtKtA4aXxT4.LFTtstGrFpslEh56X2Xd3FoUwx7zq9q', 'lecturer', 1, '2025-06-09 23:42:22', '2025-06-09 23:42:22'),
(2, 'mutima', 'Emmy', 'mutima@gmil.com', '$2b$10$ESKaAEoTO9gBchQokLpoOOkjqHJpPxrsplMxb8YR.rqAJkOTu18Zu', 'admin', 1, '2025-06-09 23:47:00', '2025-06-09 23:47:00'),
(3, 'muvandimwe', 'Emmanuel', 'muvandimwe@gmail.com', '$2b$10$z6VUgD7DyK8RgywOyJEBLOHkWHSICl6cOodE9QtBmBnLSnsoUnAYW', 'learner', 1, '2025-06-09 23:55:44', '2025-06-09 23:55:44'),
(4, 'kelly', 'buzima', 'buzima@gmail.com', '$2b$10$vheUse8p7Lh15nUrJXJox.6V9Bw5AsTeCsxITZhnxUeQgU3b/doIe', 'lecturer', 1, '2025-06-10 00:10:46', '2025-06-10 00:10:46');

-- --------------------------------------------------------

--
-- Table structure for table `user_content_progress`
--

CREATE TABLE `user_content_progress` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `content_id` int(11) NOT NULL,
  `is_completed` tinyint(1) NOT NULL DEFAULT 1,
  `completed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_quiz_attempts`
--

CREATE TABLE `user_quiz_attempts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `quiz_content_id` int(11) NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `attempt_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `submitted_answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`submitted_answers`))
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `content`
--
ALTER TABLE `content`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_content_module` (`module_id`);

--
-- Indexes for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_enrollment` (`user_id`,`module_id`),
  ADD KEY `fk_enrollment_module` (`module_id`);

--
-- Indexes for table `modules`
--
ALTER TABLE `modules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_module_instructor` (`instructor_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_content_progress`
--
ALTER TABLE `user_content_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_content_progress` (`user_id`,`content_id`),
  ADD KEY `fk_progress_content` (`content_id`);

--
-- Indexes for table `user_quiz_attempts`
--
ALTER TABLE `user_quiz_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_attempt_user` (`user_id`),
  ADD KEY `fk_attempt_quiz_content` (`quiz_content_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `content`
--
ALTER TABLE `content`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `enrollments`
--
ALTER TABLE `enrollments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `modules`
--
ALTER TABLE `modules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `user_content_progress`
--
ALTER TABLE `user_content_progress`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_quiz_attempts`
--
ALTER TABLE `user_quiz_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `content`
--
ALTER TABLE `content`
  ADD CONSTRAINT `fk_content_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD CONSTRAINT `fk_enrollment_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_enrollment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `modules`
--
ALTER TABLE `modules`
  ADD CONSTRAINT `fk_module_instructor` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `user_content_progress`
--
ALTER TABLE `user_content_progress`
  ADD CONSTRAINT `fk_progress_content` FOREIGN KEY (`content_id`) REFERENCES `content` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_quiz_attempts`
--
ALTER TABLE `user_quiz_attempts`
  ADD CONSTRAINT `fk_attempt_quiz_content` FOREIGN KEY (`quiz_content_id`) REFERENCES `content` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
