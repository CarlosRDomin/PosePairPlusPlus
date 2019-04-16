import numpy as np


class PoseParams:
    """ Structure that holds the configuration parameters for the human pose model """

    def __init__(self, plot_skeletons=True, plot_wrist_trail=False):
        self.plot_skeletons = plot_skeletons  # Whether or not to draw skeletons on top of people
        self.plot_wrist_trail = plot_wrist_trail  # Whether or not to draw a red trail with the history position of each person's R_wrist


class CamParams:
    """ Structure that holds the configuration parameters for the camera-related settings """

    def __init__(self, bool_mirror=False, focal_length_in_px=1250.0, camera_matrix=None, dist_coefs=None):
        self.bool_mirror = bool_mirror  # Whether or not to mirror the input image
        self.focal_length_in_px = focal_length_in_px
        self.camera_matrix = camera_matrix if camera_matrix is not None else np.matrix([[focal_length_in_px, 0, 1280./2], [0, focal_length_in_px, 720./2], [0, 0, 1]])
        self.dist_coefs = dist_coefs


class InOutParams:
    """ Structure that holds the configuration parameters for IO-related settings """
    FRAME_FILENAME_FORMAT = "frame{:05d}"
    RENDERED_FRAME_FILENAME_FORMAT = "{}_" + FRAME_FILENAME_FORMAT + ".jpg"
    RENDERED_FOLDER_NAME = "Rendered"
    TEMP_FILENAME = "frame.jpg"

    def __init__(self, video_input=0, save_rendered_output=True, save_render_as_video=True, visualize_in_separate_process=True):
        self.video_input = video_input  # Camera id or video filename to pass to cv2.VideoCapture
        self.save_rendered_output = save_rendered_output  # Whether or not to save each frame's image+pose render
        self.save_render_as_video = save_render_as_video  # In case save_rendered_output is True, this determines whether to save all frames in a video (True) or as individual jpg's (False)
        self.visualize_in_separate_process = visualize_in_separate_process  # Whether or not to display each processed frame in a separate process (better performance)

    @staticmethod
    def datetime_to_str(t):
        return str(t)[:-7].replace(':', '-')


class AllParams:
    """ Structure that holds the configuration parameters for the overall project """

    def __init__(self, video_input=0, pose=None, cam=None, io=None):
        self.pose = pose if pose is not None else PoseParams()  # Pose params
        self.cam = cam if cam is not None else CamParams()  # Camera params
        self.io = io if io is not None else InOutParams(video_input=video_input)  # IO params
