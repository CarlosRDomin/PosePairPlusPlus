import cv2
import numpy as np
from process_helpers import ProcessImshowHelper
from config import AllParams
from scipy.optimize import linear_sum_assignment
from collections import deque
from enum import Enum
from datetime import datetime
import os


class JointEnum(Enum):
    NOSE = 0
    NECK = 1
    RSHOULDER = 2
    RELBOW = 3
    RWRIST = 4
    LSHOULDER = 5
    LELBOW = 6
    LWRIST = 7
    MIDHIP = 8
    RHIP = 9
    RKNEE = 10
    RANKLE = 11
    LHIP = 12
    LKNEE = 13
    LANKLE = 14
    REYE = 15
    LEYE = 16
    REAR = 17
    LEAR = 18
    LBIGTOE = 19
    LSMALLTOE = 20
    LHEEL = 21
    RBIGTOE = 22
    RSMALLTOE = 23
    RHEEL = 24
    BACKGND = 25


class MultiPersonTracker:
    """
     Associates the same person in two different frames to the same ID.
    """
    MIN_OVERLAP = 0.01

    def __init__(self, min_confidence=0.1, cost_old_person_not_tracked=2000, cost_new_person_starts_track=2000):
        self.MIN_CONFIDENCE = min_confidence
        self.COST_OLD_PERSON_NOT_TRACKED = cost_old_person_not_tracked
        self.COST_NEW_PERSON_STARTS_TRACK = cost_new_person_starts_track
        self.COST_DEFAULT = 2*(cost_old_person_not_tracked + cost_new_person_starts_track)
        self.last_joints_list = None
        self.last_bboxes = None

    def update(self, joints_list):  # joints_list is N_people x 25 x 3. The last index in 25th row (would be background) is used for person ID
        bboxes = find_all_people_bboxes(joints_list)
        if self.last_joints_list is None:
            joints_list[:,-1,-1] = range(len(joints_list))  # Initialize IDs to 0...(N-1)
        else:
            M,N = len(self.last_joints_list), len(joints_list)
            assignment_cost = self.COST_DEFAULT*np.ones((M+N, M+N))
            assignment_cost[M:,N:] = 0
            np.fill_diagonal(assignment_cost[:M,N:], self.COST_OLD_PERSON_NOT_TRACKED)
            np.fill_diagonal(assignment_cost[M:,:N], self.COST_NEW_PERSON_STARTS_TRACK)

            for new_idx,new_person in enumerate(joints_list):
                # Compute the IoU overlap between this person and all others found in the previous frame
                overlap = np.maximum(compute_bbox_overlap(bboxes[new_idx], self.last_bboxes), self.MIN_OVERLAP)  # Avoid division by 0 by ensuring overlap >= MIN_OVERLAP (0.01)

                # Traverse every person found in last frame and compute matching score
                for old_idx,old_person in enumerate(self.last_joints_list):
                    # common_joints = np.where(np.logical_and(old_person[0:-2]>=0, new_person[0:-2]>=0))[0]  # Figure out which joints were found both in the previous and in the current frame
                    common_joints = np.where(np.logical_and(old_person[:-1,-1]>=self.MIN_CONFIDENCE, new_person[:-1,-1]>=self.MIN_CONFIDENCE))[0]  # Figure out which joints were found both in the previous and in the current frame (ignore the confidence in the background)
                    score = self.COST_DEFAULT  # Default: very high score to ensure they're not matched
                    if len(common_joints) > 0:
                        old_joint_coords = old_person[common_joints, :2]
                        new_joint_coords = new_person[common_joints, :2]
                        score = np.mean(np.linalg.norm(new_joint_coords - old_joint_coords, axis=1)) / overlap[old_idx]  # Score: average distance weighted by 1/IoU
                    assignment_cost[old_idx, new_idx] = score

            old_tracks_idx, new_tracks_idx = linear_sum_assignment(assignment_cost)  # old_tracks_idx=range(M+N) and new_tracks_idx will indicate who each old_tracks_idx is matched to
            same_person_idx = np.where(new_tracks_idx[:M]<N)[0]  # Same person if the first M indices (each person found in the previous frame) are matched to a value smaller than N (matched to a person in the new frame)
            joints_list[new_tracks_idx[same_person_idx], -1, -1] = self.last_joints_list[old_tracks_idx[same_person_idx], -1, -1]  # Use same ID for same people
            new_person_idx = M + np.where(new_tracks_idx[M:]<N)[0]  # New person (new ID) if a person in the new frame (new_tracks_idx<N) is matched to one of the auxiliary rows with cost=self.COST_NEW_PERSON_STARTS_TRACK
            new_ID_start = max(self.last_joints_list[:,-1,-1])+1 if M > 0 else 0
            joints_list[new_tracks_idx[new_person_idx], -1, -1] = new_ID_start + np.arange(len(new_person_idx))

        self.last_joints_list = joints_list.copy()
        self.last_bboxes = bboxes


class MultiPersonJointTracker:
    """
     Helper class to plot a trail with the history positions of a given joint (e.g. wrist).
     Can simultaneously track that joint for multiple people, displaying independent point trails.
    """

    def __init__(self, joint_to_track=JointEnum.RWRIST.value, buff_size=40):
        self.joint_to_track = joint_to_track
        self.buff_size = buff_size
        self.trajectories = {'IDs': [], 'pts_deques': []}

    def update_trajectory(self, ind_trajectory, id, joints_list):  # Finds the RWRIST of person with ID id, and appendsleft the coordinates to pts_deques[ind_trajectory]
        found = np.where(joints_list[:, -1, -1] == id)[0]
        joint_coords = tuple(joints_list[found[0], self.joint_to_track, :2].astype(int)) if len(found) > 0 else None
        self.trajectories['pts_deques'][ind_trajectory].appendleft(joint_coords)

    def update(self, joints_list):
        for i, id in enumerate(self.trajectories['IDs']):
            self.update_trajectory(i, id, joints_list)

        new_IDs = set(joints_list[:,-1,-1]).difference(self.trajectories['IDs'])
        for id in new_IDs:
            self.trajectories['IDs'].append(id)
            self.trajectories['pts_deques'].append(deque(maxlen=self.buff_size))
            self.update_trajectory(len(self.trajectories['pts_deques'])-1, id, joints_list)

    def plot(self, frame, color = (0,0,255), num_points=20):
        for pts in self.trajectories['pts_deques'][-num_points:]:
            for i in range(1, len(pts)):
                if pts[i-1] is None or pts[i] is None:  # If either of the tracked points are None, ignore them
                    continue

                # otherwise, draw a connecting line
                thickness = int(np.sqrt(self.buff_size / float(i+1))*2.5)
                cv2.line(frame, pts[i-1], pts[i], color, thickness)


class FrameProcessor:
    """ Helper class to process a sequence of frames and display and/or save the processed results """
    FPS_ALPHA = 0.9

    def __init__(self, params=None):
        self.params = params if params is not None else AllParams()
        self.person_tracker = MultiPersonTracker()
        self.wrist_tracker = MultiPersonJointTracker()
        self.pilot_bbox = None
        self.joints_list = None
        self.frame_num = 0
        self.fps = None
        self.filename_prefix = "cam_{}_{}".format(self.params.io.video_input, self.params.io.datetime_to_str(datetime.now())) if isinstance(self.params.io.video_input, int) else self.params.io.video_input.rsplit('.',1)[0]

        # Open the input (cam device or video filename)
        self.img = self.img_out = None
        if False:
            self.video = cv2.VideoCapture(self.params.io.video_input)
            self.total_frames = int(self.video.get(cv2.CAP_PROP_FRAME_COUNT))  # If video, indicates the total number of frames (so we can log how much we've processed)
            fps = self.video.get(cv2.CAP_PROP_FPS)
            img_width = int(self.video.get(cv2.CAP_PROP_FRAME_WIDTH))
            img_height = int(self.video.get(cv2.CAP_PROP_FRAME_HEIGHT))

            # Initialize rendered video (if save_render_as_video=True)
            if self.params.io.save_rendered_output and self.params.io.save_render_as_video:
                self.video_out = cv2.VideoWriter(self.get_rendered_frame_filename(), cv2.VideoWriter_fourcc(*'avc1'), fps if fps > 0 else 13, (img_width,img_height))  # Note: avc1 is Apple's version of the MPEG4 part 10/H.264 standard apparently

        # Launch frame visualizer process
        self.imshow_helper = ProcessImshowHelper(self.params.io.TEMP_FILENAME, 'Camera')
        print('Frame visualizer process spawned!')

        # Initialize rendered video (if save_render_as_video=True)
        # self.video_out = cv2.VideoWriter(self.get_rendered_frame_filename(), cv2.VideoWriter_fourcc(*'avc1'), 13, (img_width, img_height))  # Note: avc1 is Apple's version of the MPEG4 part 10/H.264 standard apparently

        self.t_last_frame = datetime.now()

    def get_rendered_frame_filename(self):
        if self.params.io.save_rendered_output:
            if self.params.io.save_render_as_video:  # Save all rendered frames in a "*_rendered.mp4" video
                return "{}_rendered.mp4".format(self.filename_prefix)
            else:  # Save each individual frame inside a folder (e.g. "./Rendered/")
                filename_prefix = os.path.join(os.path.dirname(self.filename_prefix), self.params.io.RENDERED_FOLDER_NAME, os.path.basename(self.filename_prefix))  # Insert the "/Rendered/" folder in between
                return self.params.io.RENDERED_FRAME_FILENAME_FORMAT.format(filename_prefix, self.frame_num)  # Apply the format: ./Rendered/*_frame{N:05d}.jpg
        else:
            return self.params.io.TEMP_FILENAME

    def get_frame(self):
        # Read next frame
        ok, self.img = self.video.read()
        if not ok:
            print("ALL VIDEO FRAMES READ! :)" if self.total_frames > 0 and self.frame_num >= self.total_frames else "Error reading frame :(")
            return False

        # Mirror if needed
        if self.params.cam.bool_mirror:
            if self.params.pose.use_openpose:
                self.img = cv2.flip(self.img, 1)
            else:
                self.img = self.img[:, ::-1, :]

        # Increase frame counter
        self.frame_num += 1
        return True

    def run_pose_model(self):
        t1 = datetime.now()

        if self.pilot_bbox is None:  # Initialize pilot if necessary
            self.pilot_bbox = find_largest_bbox(self.joints_list)
        # self.person_to_joint_assoc = find_same_person(self.pilot_bbox, self.joints_list)  # Reorder person_to_joint_assoc based on overlap with pilot_bbox
        self.person_tracker.update(self.joints_list)  # Assign same ID to people that appeared on last frame
        self.wrist_tracker.update(self.joints_list)  # Track each person's wrist
        if self.params.pose.plot_wrist_trail: self.wrist_tracker.plot(self.img_out)  # Plot a trail of points with the history of wrist positions
        self.pilot_bbox = draw_bbox(self.img_out, self.joints_list, True)  # And add a bounding-box around the main target

        t2 = datetime.now()
        if False:
            print("MODEL RUNS IN: {:6.2f}ms".format(1000*(t2-t1).total_seconds()))

    def save_frame_results(self):
        # Helper function to save img_out as a temp jpg for visualization in the other process (if requested through params.io)
        def save_temp_frame_if_needed_for_visualization():
            if self.params.io.visualize_in_separate_process:
                cv2.imwrite(self.params.io.TEMP_FILENAME, self.img_out, (cv2.IMWRITE_JPEG_QUALITY, 25))  # Only used for visualization, so quality 25 is enough

        # Save img_out to file
        if self.params.io.save_rendered_output:
            if self.params.io.save_render_as_video:
                self.video_out.write(self.img_out)
                save_temp_frame_if_needed_for_visualization()
            else:
                rendered_frame_filename = self.get_rendered_frame_filename()
                cv2.imwrite(rendered_frame_filename, self.img_out, (cv2.IMWRITE_JPEG_QUALITY, 80))
                if self.params.io.visualize_in_separate_process:  # If visualizing in a separate process, no need to re-save the image in low quality, reuse the one we just saved
                    self.imshow_helper.set_filename(rendered_frame_filename)  # Update filename to visualize the latest frame we just saved
        else:
            save_temp_frame_if_needed_for_visualization()  # Only save temp jpg if visualizing in a separate process

        # Visualize it in this process if requested
        if not self.params.io.visualize_in_separate_process:
            cv2.imshow("Camera", self.img_out)

    def process_kb(self):
        if self.params.io.visualize_in_separate_process:
            keys = self.imshow_helper.get_keys_pressed()
        else:
            key = cv2.waitKeyEx(1)
            keys = [key] if key >=0 else []

        should_exit = False
        for key in keys:
            print('KEY PRESSED: {} ({})'.format(key, chr(key) if key < 256 else 'special ch'))
            if key == ord('q'):
                should_exit = True

        return not should_exit

    def update_fps(self):
        fps_curr = 1 / (datetime.now() - self.t_last_frame).total_seconds()
        self.fps = fps_curr if self.fps is None else self.FPS_ALPHA*self.fps + (1-self.FPS_ALPHA)*fps_curr
        progress_info = "/{} ({:5.2f}%)".format(self.total_frames, 100.0*self.frame_num/self.total_frames) if self.total_frames > 0 else ""
        print("Curr frame: {:5d}{}; FPS: smoothed {:5.2f}\tinstantaneous {:5.2f}".format(self.frame_num, progress_info, self.fps, fps_curr))
        self.t_last_frame = datetime.now()

    def terminate(self):
        self.video.release()  # Close cam/video input
        cv2.destroyAllWindows()  # Close all cv2 windows
        if self.params.io.pose_h5_file_handle is not None:
            self.params.io.pose_h5_file_handle.close()  # Close pose file
        if self.params.io.visualize_in_separate_process and not (self.params.io.save_rendered_output and not self.params.io.save_render_as_video):
            os.remove(self.params.io.TEMP_FILENAME)  # Delete temp file (used for visualization)

    def run_demo(self):
        while True:
            if not self.get_frame():
                break
            self.run_pose_model()
            self.save_frame_results()
            if not self.process_kb():
                break
            self.update_fps()
        print('EXITING!')
        self.terminate()


def compute_bbox_overlap(reference_bbox, bboxes):
    """ Compute the IoU overlap between a given bbox and a set of bboxes """
    reference_bbox = np.reshape(reference_bbox, (-1, 4))  # Ensure they are 2d arrays and not 1d (in case there's only one person found)
    bboxes = np.reshape(bboxes, (-1, 4))  # Make sure bboxes is an np.array so we can compute all overlaps at once

    minimum_coords = np.minimum(reference_bbox, bboxes)
    maximum_coords = np.maximum(reference_bbox, bboxes)
    union_bboxes        = np.hstack((minimum_coords[:,:2], maximum_coords[:,2:]))
    intersection_bboxes = np.hstack((maximum_coords[:,:2], minimum_coords[:,2:]))

    intersection_width  = np.maximum(0, intersection_bboxes[:,2]-intersection_bboxes[:,0]+1)
    intersection_height = np.maximum(0, intersection_bboxes[:,3]-intersection_bboxes[:,1]+1)
    union_width  = np.maximum(0, union_bboxes[:,2]-union_bboxes[:,0]+1)
    union_height = np.maximum(0, union_bboxes[:,3]-union_bboxes[:,1]+1)

    overlap = (intersection_width*intersection_height) / (union_width*union_height)
    return overlap


def find_same_person(reference_bbox, joints_list):
    """ Sort the rows in joints_list based on bounding-box overlap with the reference_bbox (highest overlap first) """
    bboxes = find_all_people_bboxes(joints_list)
    if len(bboxes) == 0:  # Nothing to do, there's no people in the frame!
        return joints_list

    overlap = compute_bbox_overlap(reference_bbox, bboxes)

    def custom_sort_based_on_overlap(i, j):  # Both i and j are tuples, where [0] is an overlap percentage, and [1] is their person_info
        if i[0] < j[0]:
            return -1
        elif i[0] > j[0]:
            return 1
        else:  # Exactly the same overlap (eg: 0% overlap)
            return cmp(i[1][-1,-1], j[1][-1,-1])  # Return whoever has higher person ID

    return np.asarray([x for (y, x) in sorted(zip(overlap, joints_list), cmp=custom_sort_based_on_overlap, reverse=True)])  # Sort person_to_joint_assoc based on overlap (higher overlap = lower index)


def find_person_bbox(person_ind, joints_list, MIN_CONFIDENCE=0.1):
    """ Return the bounding-box corresponding to the given person (specified by a row from person_to_joint_assoc) """
    person_joints_found = np.where(joints_list[person_ind, :-1, -1] >= MIN_CONFIDENCE)[0]
    joint_coords = joints_list[person_ind, person_joints_found, :2]
    xy_min = np.min(joint_coords, axis=0)
    xy_max = np.max(joint_coords, axis=0)
    return np.hstack((xy_min, xy_max))


def find_all_people_bboxes(joints_list):
    """ Return a list of bounding boxes, one for each person found in the image """
    bboxes = []
    for person_ind in range(len(joints_list)):
        bboxes.append(find_person_bbox(person_ind, joints_list))
    return bboxes


def find_largest_bbox(joints_list):
    """ Return the bounding-box among all people found in the image with largest area """
    return sorted(find_all_people_bboxes(joints_list), key=lambda bbox: (bbox[2]-bbox[0]) * (bbox[3]-bbox[1]))[-1]  # Sort by area and return the last one

    # max_bbox_area = -1
    # max_bbox = None
    #
    # for person_ind in range(len(joints_list)):
    #     bbox = find_person_bbox(person_ind, joints_list)
    #     current_area = (bbox[2]-bbox[0]) * (bbox[3]-bbox[1])
    #     if current_area >= max_bbox_area:
    #         max_bbox_area = current_area
    #         max_bbox = bbox
    #
    # return max_bbox


def draw_bbox(canvas, joints_list, bool_plot=True, bool_plot_pilot_only=False, id=None):
    """ Draw bounding boxes around people found in the image (or only the main target if bool_plot_pilot_only=True) """
    if id is None and len(joints_list) > 0:
        id = joints_list[0,-1,-1]
    COLOR_PILOT     = (0, 255, 0)
    COLOR_NOT_PILOT = (0, 0, 255)
    THICKNESS_PILOT     = 2
    THICKNESS_NOT_PILOT = 1

    # 12/2/18 update: plot all bboxes the same way for visualization (no notion of 'pilot' for ID-IoT)
    COLOR_NOT_PILOT = COLOR_PILOT
    THICKNESS_PILOT = THICKNESS_NOT_PILOT

    pilot_bbox = None
    for person_ind, person in enumerate(joints_list):
        bbox = find_person_bbox(person_ind, joints_list)
        if person[-1,-1] == id:
            pilot_bbox = bbox
        if bool_plot and (person[-1,-1] == id or not bool_plot_pilot_only):
            xy_min = np.round(bbox[:2]).astype(int)
            xy_max = np.round(bbox[2:]).astype(int)
            color = COLOR_PILOT if person[-1,-1] == id else COLOR_NOT_PILOT
            thickness = THICKNESS_PILOT if person[-1,-1] == id else THICKNESS_NOT_PILOT
            cv2.rectangle(canvas, tuple(xy_min), tuple(xy_max), color, thickness=thickness)
            cv2.putText(canvas, str((person[-1,-1] if True else person_ind)+1), tuple(xy_min+[0, 25]), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 1, cv2.LINE_AA)
            if False and person[-1,-1] == id:
                cv2.putText(canvas, 'PILOT', tuple(xy_min-[0,15]), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 1, cv2.LINE_AA)

    return pilot_bbox
